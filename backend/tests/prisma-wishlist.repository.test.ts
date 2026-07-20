import {
  Prisma,
  type PrismaClient,
} from "../src/prisma/generated/client.js";
import {
  DuplicateWishlistItemError,
  WishlistProductNotFoundError,
} from "../src/repositories/wishlist.errors.js";
import { PrismaWishlistRepository } from "../src/repositories/prisma-wishlist.repository.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const productId = "00000000-0000-4000-8000-000000000001";
const customerId = "00000000-0000-4000-8000-000000000002";
const wishlistItemId = "00000000-0000-4000-8000-000000000003";

describe("PrismaWishlistRepository", () => {
  let client: ReturnType<typeof createPrismaClientMock>;
  let repository: PrismaWishlistRepository;

  beforeEach(() => {
    client = createPrismaClientMock();
    repository = new PrismaWishlistRepository(
      client as unknown as PrismaClient,
    );
  });

  it("creates and maps a wishlist item for an existing product", async () => {
    client.product.findUnique.mockResolvedValue({ id: productId });
    client.wishlistItem.create.mockResolvedValue(wishlistRecord());

    const result = await repository.create({ customerId, productId });

    expect(result).toEqual(mappedWishlistRecord());
    expect(client.wishlistItem.create).toHaveBeenCalledWith({
      data: { customerId, productId },
      include: wishlistInclude(),
    });
  });

  it("translates duplicate and missing-product failures", async () => {
    client.product.findUnique.mockResolvedValue({ id: productId });
    client.wishlistItem.create.mockRejectedValue(prismaError("P2002"));

    await expect(
      repository.create({ customerId, productId }),
    ).rejects.toBeInstanceOf(DuplicateWishlistItemError);

    client.product.findUnique.mockResolvedValue(null);

    await expect(
      repository.create({ customerId, productId }),
    ).rejects.toBeInstanceOf(WishlistProductNotFoundError);
  });

  it("lists a customer's wishlist in deterministic newest-first order", async () => {
    const newest = wishlistRecord({
      id: "00000000-0000-4000-8000-000000000004",
      productId: "00000000-0000-4000-8000-000000000005",
      createdAt: new Date("2026-07-19T08:00:00.000Z"),
    });
    const oldest = wishlistRecord();
    client.wishlistItem.findMany.mockResolvedValue([newest, oldest]);

    const result = await repository.findByCustomerId(customerId);

    expect(result).toEqual([
      mappedWishlistRecord(newest),
      mappedWishlistRecord(oldest),
    ]);
    expect(client.wishlistItem.findMany).toHaveBeenCalledWith({
      where: { customerId },
      include: wishlistInclude(),
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  });

  it("deletes only a matching customer and product entry", async () => {
    client.wishlistItem.deleteMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    await expect(
      repository.delete(customerId, productId),
    ).resolves.toBe(true);
    await expect(
      repository.delete(customerId, productId),
    ).resolves.toBe(false);
    expect(client.wishlistItem.deleteMany).toHaveBeenCalledWith({
      where: { customerId, productId },
    });
  });
});

function createPrismaClientMock() {
  const client = {
    product: {
      findUnique: vi.fn(),
    },
    wishlistItem: {
      create: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  client.$transaction.mockImplementation(
    async (operation: (transaction: typeof client) => unknown) =>
      operation(client),
  );

  return client;
}

function wishlistRecord(
  overrides: Partial<ReturnType<typeof baseWishlistRecord>> = {},
) {
  return {
    ...baseWishlistRecord(),
    ...overrides,
  };
}

function baseWishlistRecord() {
  return {
    id: wishlistItemId,
    customerId,
    productId,
    createdAt: new Date("2026-07-18T08:00:00.000Z"),
    product: {
      id: productId,
      sellerId: "00000000-0000-4000-8000-000000000006",
      categoryId: "00000000-0000-4000-8000-000000000007",
      name: "Portland Cement",
      description: "High-strength bagged cement.",
      price: new Prisma.Decimal("850.00"),
      quantity: 20,
      imageUrl: "https://example.com/cement.jpg",
      seller: {
        id: "00000000-0000-4000-8000-000000000006",
        name: "Seller One",
      },
      category: {
        id: "00000000-0000-4000-8000-000000000007",
        name: "Cement",
      },
      createdAt: new Date("2026-07-17T08:00:00.000Z"),
      updatedAt: new Date("2026-07-17T08:00:00.000Z"),
    },
  };
}

function mappedWishlistRecord(
  record = wishlistRecord(),
) {
  return {
    id: record.id,
    customerId: record.customerId,
    productId: record.productId,
    createdAt: record.createdAt,
    product: {
      ...record.product,
      price: record.product.price.toFixed(2),
    },
  };
}

function wishlistInclude() {
  return {
    product: {
      include: {
        seller: {
          select: {
            id: true,
            name: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    },
  };
}

function prismaError(code: string): Error & { code: string } {
  return Object.assign(new Error(`Prisma error ${code}`), { code });
}
