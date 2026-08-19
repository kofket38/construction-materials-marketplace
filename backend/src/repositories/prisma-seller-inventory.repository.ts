import { Prisma, type PrismaClient } from "../prisma/generated/client.js";
import {
  SellerInventoryDuplicateError,
  SellerInventoryProductNotFoundError,
  SellerInventoryProductNotOwnedError,
} from "./seller-inventory.errors.js";
import type {
  CreateSellerInventoryInput,
  SellerInventoryEntity,
  SellerInventoryListInput,
  SellerInventoryListResult,
  SellerInventoryRepository,
  UpdateSellerInventoryInput,
} from "./seller-inventory.repository.js";

const inventoryInclude = {
  product: {
    select: {
      name: true,
      imageUrl: true,
    },
  },
} satisfies Prisma.SellerInventoryInclude;

type InventoryWithProduct = Prisma.SellerInventoryGetPayload<{
  include: typeof inventoryInclude;
}>;

function mapInventory(row: InventoryWithProduct): SellerInventoryEntity {
  return {
    id: row.id,
    sellerId: row.sellerId,
    productId: row.productId,
    productName: row.product.name,
    productImageUrl: row.product.imageUrl,
    city: row.city,
    region: row.region,
    price: row.price.toFixed(2),
    quantity: row.quantity,
    deliveryAvailable: row.deliveryAvailable,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

export class PrismaSellerInventoryRepository
  implements SellerInventoryRepository
{
  constructor(private readonly client: PrismaClient) {}

  async list(input: SellerInventoryListInput): Promise<SellerInventoryListResult> {
    const where: Prisma.SellerInventoryWhereInput = {
      sellerId: input.sellerId,
      ...(input.city !== undefined
        ? { city: { contains: input.city.trim(), mode: "insensitive" } }
        : {}),
      ...(input.search !== undefined
        ? {
            product: {
              is: {
                name: { contains: input.search.trim(), mode: "insensitive" },
              },
            },
          }
        : {}),
    };

    const [total, rows] = await this.client.$transaction([
      this.client.sellerInventory.count({ where }),
      this.client.sellerInventory.findMany({
        where,
        include: inventoryInclude,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
    ], { timeout: 30_000 });

    return {
      inventory: rows.map(mapInventory),
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  async findById(id: string): Promise<SellerInventoryEntity | null> {
    const row = await this.client.sellerInventory.findUnique({
      where: { id },
      include: inventoryInclude,
    });

    return row ? mapInventory(row) : null;
  }

  async create(input: CreateSellerInventoryInput): Promise<SellerInventoryEntity> {
    // Verify the product exists and belongs to this seller.
    const product = await this.client.product.findUnique({
      where: { id: input.productId },
      select: { id: true, sellerId: true },
    });

    if (!product) {
      throw new SellerInventoryProductNotFoundError(input.productId);
    }
    if (product.sellerId !== input.sellerId) {
      throw new SellerInventoryProductNotOwnedError();
    }

    try {
      const row = await this.client.sellerInventory.create({
        data: {
          sellerId: input.sellerId,
          productId: input.productId,
          price: new Prisma.Decimal(input.price),
          quantity: input.quantity,
          city: input.city.trim(),
          region: input.region?.trim() ?? null,
          deliveryAvailable: input.deliveryAvailable,
        },
        include: inventoryInclude,
      });

      return mapInventory(row);
    } catch (error) {
      if (hasPrismaCode(error, "P2002")) {
        throw new SellerInventoryDuplicateError();
      }
      throw error;
    }
  }

  async update(
    id: string,
    input: UpdateSellerInventoryInput,
  ): Promise<SellerInventoryEntity | null> {
    const existing = await this.client.sellerInventory.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    const row = await this.client.sellerInventory.update({
      where: { id },
      data: {
        ...(input.price !== undefined
          ? { price: new Prisma.Decimal(input.price) }
          : {}),
        ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
        ...(input.city !== undefined ? { city: input.city.trim() } : {}),
        ...(input.region !== undefined ? { region: input.region?.trim() ?? null } : {}),
        ...(input.deliveryAvailable !== undefined
          ? { deliveryAvailable: input.deliveryAvailable }
          : {}),
      },
      include: inventoryInclude,
    });

    return mapInventory(row);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.client.sellerInventory.delete({ where: { id } });
      return true;
    } catch (error) {
      if (hasPrismaCode(error, "P2025")) {
        return false;
      }
      throw error;
    }
  }
}
