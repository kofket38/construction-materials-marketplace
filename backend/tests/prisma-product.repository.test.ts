import {
  Prisma,
  type PrismaClient,
} from "../src/prisma/generated/client.js";
import { PrismaProductRepository } from "../src/repositories/prisma-product.repository.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const productId = "00000000-0000-4000-8000-000000000001";
const primaryImageUrl = "https://example.com/cement-primary.jpg";
const legacyImageUrl = "https://example.com/cement-legacy.jpg";

describe("PrismaProductRepository", () => {
  let client: ReturnType<typeof createPrismaClientMock>;
  let repository: PrismaProductRepository;

  beforeEach(() => {
    client = createPrismaClientMock();
    repository = new PrismaProductRepository(
      client as unknown as PrismaClient,
    );
  });

  it("maps the normalized primary image when the legacy image URL is null", async () => {
    client.product.count.mockResolvedValue(1);

    client.product.findMany.mockResolvedValue([
      productRecord({
        imageUrl: null,
        images: [{ imageUrl: primaryImageUrl }],
      }),
    ]);

    const result = await repository.findAll(discoveryQuery());

    expect(result.products[0]?.imageUrl).toBe(primaryImageUrl);

    expect(client.product.findMany).toHaveBeenCalled();

    const call = client.product.findMany.mock.calls[0]?.[0];

    expect(call).toEqual(
      expect.objectContaining({
        include: expect.objectContaining({
          images: expect.any(Object),
        }),
      }),
    );
  });

  it("falls back to the legacy image URL when no primary image exists", async () => {
    client.product.count.mockResolvedValue(1);

    client.product.findMany.mockResolvedValue([
      productRecord({
        imageUrl: legacyImageUrl,
        images: [],
      }),
    ]);

    const result = await repository.findAll(discoveryQuery());

    expect(result.products[0]?.imageUrl).toBe(legacyImageUrl);
  });
});

function createPrismaClientMock() {
  const client = {
    product: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  client.$transaction.mockImplementation(
    async (operations: Promise<unknown>[]) => Promise.all(operations),
  );

  return client;
}

function productRecord(
  overrides: Partial<ReturnType<typeof baseProductRecord>> = {},
) {
  return {
    ...baseProductRecord(),
    ...overrides,
  };
}

function baseProductRecord() {
  return {
    id: productId,
    sellerId: "00000000-0000-4000-8000-000000000002",
    categoryId: "00000000-0000-4000-8000-000000000003",
    name: "Portland Cement",
    description: "High-strength bagged cement.",
    price: new Prisma.Decimal("850.00"),
    quantity: 20,
    imageUrl: legacyImageUrl as string | null,
    seller: {
      id: "00000000-0000-4000-8000-000000000002",
      name: "Seller One",
    },
    category: {
      id: "00000000-00000000-4000-8000-000000000003",
      name: "Cement",
    },
    images: [] as Array<{ imageUrl: string }>,
    createdAt: new Date("2026-07-17T08:00:00.000Z"),
    updatedAt: new Date("2026-07-17T08:00:00.000Z"),
  };
}

function discoveryQuery() {
  return {
    page: 1,
    limit: 20,
    sortBy: "newest",
    sortOrder: "desc",
  } as const;
}