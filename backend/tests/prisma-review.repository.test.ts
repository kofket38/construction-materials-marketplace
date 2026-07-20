import type { PrismaClient } from "../src/prisma/generated/client.js";
import {
  DuplicateReviewError,
  ReviewPurchaseRequiredError,
} from "../src/repositories/review.errors.js";
import { PrismaReviewRepository } from "../src/repositories/prisma-review.repository.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const productId = "00000000-0000-4000-8000-000000000001";
const customerId = "00000000-0000-4000-8000-000000000002";
const reviewId = "00000000-0000-4000-8000-000000000003";

describe("PrismaReviewRepository", () => {
  let client: ReturnType<typeof createPrismaClientMock>;
  let repository: PrismaReviewRepository;

  beforeEach(() => {
    client = createPrismaClientMock();
    repository = new PrismaReviewRepository(
      client as unknown as PrismaClient,
    );
  });

  it("creates a review after confirming a delivered purchase", async () => {
    const record = reviewRecord({ rating: 5 });
    client.product.findUnique.mockResolvedValue({ id: productId });
    client.orderItem.findFirst.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000004",
    });
    client.review.create.mockResolvedValue(record);

    const result = await repository.create({
      productId,
      customerId,
      rating: 5,
      comment: "Excellent.",
    });

    expect(result).toEqual(record);
    expect(client.orderItem.findFirst).toHaveBeenCalledWith({
      where: {
        productId,
        order: {
          is: {
            customerId,
            status: "DELIVERED",
          },
        },
      },
      select: { id: true },
    });
  });

  it("translates unique constraint failures into duplicate reviews", async () => {
    client.product.findUnique.mockResolvedValue({ id: productId });
    client.orderItem.findFirst.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000004",
    });
    client.review.create.mockRejectedValue(prismaError("P2002"));

    await expect(
      repository.create({
        productId,
        customerId,
        rating: 4,
      }),
    ).rejects.toBeInstanceOf(DuplicateReviewError);
  });

  it("rejects customers without a delivered order item", async () => {
    client.product.findUnique.mockResolvedValue({ id: productId });
    client.orderItem.findFirst.mockResolvedValue(null);

    await expect(
      repository.create({
        productId,
        customerId,
        rating: 4,
      }),
    ).rejects.toBeInstanceOf(ReviewPurchaseRequiredError);
    expect(client.review.create).not.toHaveBeenCalled();
  });

  it("maps public review listings and their aggregate rating", async () => {
    const newest = reviewRecord({
      id: "00000000-0000-4000-8000-000000000005",
      rating: 4,
      customerId: "00000000-0000-4000-8000-000000000006",
      customer: {
        id: "00000000-0000-4000-8000-000000000006",
        name: "Second Customer",
      },
    });
    const oldest = reviewRecord({ rating: 5 });
    client.product.findUnique.mockResolvedValue({ id: productId });
    client.review.findMany.mockResolvedValue([newest, oldest]);

    const result = await repository.findByProductId(productId);

    expect(result).toEqual({
      reviews: [newest, oldest],
      averageRating: 4.5,
      reviewCount: 2,
    });
    expect(client.review.findMany).toHaveBeenCalledWith({
      where: { productId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  });
});

function createPrismaClientMock() {
  const client = {
    product: {
      findUnique: vi.fn(),
    },
    orderItem: {
      findFirst: vi.fn(),
    },
    review: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  client.$transaction.mockImplementation(
    async (operation: (transaction: typeof client) => unknown) =>
      operation(client),
  );

  return client;
}

function reviewRecord(
  overrides: Partial<ReturnType<typeof baseReviewRecord>> = {},
) {
  return {
    ...baseReviewRecord(),
    ...overrides,
  };
}

function baseReviewRecord() {
  return {
    id: reviewId,
    productId,
    customerId,
    rating: 5,
    comment: "Excellent.",
    customer: {
      id: customerId,
      name: "Primary Customer",
    },
    createdAt: new Date("2026-07-19T08:00:00.000Z"),
    updatedAt: new Date("2026-07-19T08:00:00.000Z"),
  };
}

function prismaError(code: string): Error & { code: string } {
  return Object.assign(new Error(`Prisma error ${code}`), { code });
}
