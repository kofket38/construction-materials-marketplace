import {
  Prisma,
  type PrismaClient,
} from "../prisma/generated/client.js";
import {
  DuplicateWishlistItemError,
  WishlistProductNotFoundError,
} from "./wishlist.errors.js";
import type {
  CreateWishlistItemInput,
  WishlistItemEntity,
  WishlistRepository,
} from "./wishlist.repository.js";

const wishlistRelations = {
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
} satisfies Prisma.WishlistItemInclude;

type WishlistItemWithProduct = Prisma.WishlistItemGetPayload<{
  include: typeof wishlistRelations;
}>;

function mapWishlistItem(
  item: WishlistItemWithProduct,
): WishlistItemEntity {
  return {
    id: item.id,
    customerId: item.customerId,
    productId: item.productId,
    product: {
      id: item.product.id,
      sellerId: item.product.sellerId,
      categoryId: item.product.categoryId,
      name: item.product.name,
      description: item.product.description,
      price: item.product.price.toFixed(2),
      quantity: item.product.quantity,
      imageUrl: item.product.imageUrl,
      seller: item.product.seller,
      category: item.product.category,
      createdAt: item.product.createdAt,
      updatedAt: item.product.updatedAt,
    },
    createdAt: item.createdAt,
  };
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

export class PrismaWishlistRepository implements WishlistRepository {
  constructor(private readonly client: PrismaClient) {}

  async create(
    input: CreateWishlistItemInput,
  ): Promise<WishlistItemEntity> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const product = await transaction.product.findUnique({
          where: { id: input.productId },
          select: { id: true },
        });
        if (!product) {
          throw new WishlistProductNotFoundError();
        }

        const item = await transaction.wishlistItem.create({
          data: input,
          include: wishlistRelations,
        });

        return mapWishlistItem(item);
      });
    } catch (error) {
      if (hasPrismaCode(error, "P2002")) {
        throw new DuplicateWishlistItemError();
      }
      if (hasPrismaCode(error, "P2003")) {
        throw new WishlistProductNotFoundError();
      }

      throw error;
    }
  }

  async findByCustomerId(
    customerId: string,
  ): Promise<WishlistItemEntity[]> {
    const items = await this.client.wishlistItem.findMany({
      where: { customerId },
      include: wishlistRelations,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });

    return items.map(mapWishlistItem);
  }

  async delete(customerId: string, productId: string): Promise<boolean> {
    const result = await this.client.wishlistItem.deleteMany({
      where: {
        customerId,
        productId,
      },
    });

    return result.count > 0;
  }
}
