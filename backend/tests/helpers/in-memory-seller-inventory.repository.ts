import { randomUUID } from "node:crypto";
import {
  SellerInventoryDuplicateError,
  SellerInventoryProductNotFoundError,
  SellerInventoryProductNotOwnedError,
} from "../../src/repositories/seller-inventory.errors.js";
import type {
  CreateSellerInventoryInput,
  SellerInventoryEntity,
  SellerInventoryListInput,
  SellerInventoryListResult,
  SellerInventoryRepository,
  UpdateSellerInventoryInput,
} from "../../src/repositories/seller-inventory.repository.js";

export interface InventoryProductSeed {
  id: string;
  sellerId: string;
  name: string;
  imageUrl?: string | null;
}

export class InMemorySellerInventoryRepository
  implements SellerInventoryRepository
{
  private readonly products = new Map<string, InventoryProductSeed>();
  private readonly entries = new Map<string, SellerInventoryEntity>();

  /** Seed a product so create() can verify ownership. */
  addProduct(product: InventoryProductSeed): void {
    this.products.set(product.id, { ...product });
  }

  /** Directly seed a SellerInventory entry, bypassing business-rule checks. */
  addEntry(
    entry: Omit<SellerInventoryEntity, "createdAt" | "updatedAt">,
  ): SellerInventoryEntity {
    const now = new Date();
    const full: SellerInventoryEntity = { ...entry, createdAt: now, updatedAt: now };
    this.entries.set(full.id, full);
    return full;
  }

  async list(input: SellerInventoryListInput): Promise<SellerInventoryListResult> {
    const normalizedSearch = input.search?.toLowerCase();
    const normalizedCity = input.city?.toLowerCase();

    const filtered = [...this.entries.values()]
      .filter((e) => e.sellerId === input.sellerId)
      .filter(
        (e) =>
          normalizedSearch === undefined ||
          e.productName.toLowerCase().includes(normalizedSearch),
      )
      .filter(
        (e) =>
          normalizedCity === undefined ||
          e.city.toLowerCase().includes(normalizedCity),
      )
      .sort(
        (a, b) =>
          b.updatedAt.getTime() - a.updatedAt.getTime() ||
          a.id.localeCompare(b.id),
      );

    const total = filtered.length;
    const page = input.page;
    const limit = input.limit;

    return {
      inventory: filtered.slice((page - 1) * limit, page * limit),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<SellerInventoryEntity | null> {
    return this.entries.get(id) ?? null;
  }

  async create(input: CreateSellerInventoryInput): Promise<SellerInventoryEntity> {
    const product = this.products.get(input.productId);
    if (!product) {
      throw new SellerInventoryProductNotFoundError(input.productId);
    }
    if (product.sellerId !== input.sellerId) {
      throw new SellerInventoryProductNotOwnedError();
    }

    // Enforce @@unique([sellerId, productId])
    const duplicate = [...this.entries.values()].find(
      (e) => e.sellerId === input.sellerId && e.productId === input.productId,
    );
    if (duplicate) {
      throw new SellerInventoryDuplicateError();
    }

    const now = new Date();
    const entry: SellerInventoryEntity = {
      id: randomUUID(),
      sellerId: input.sellerId,
      productId: input.productId,
      productName: product.name,
      productImageUrl: product.imageUrl ?? null,
      city: input.city.trim(),
      region: input.region?.trim() ?? null,
      price: Number(input.price).toFixed(2),
      quantity: input.quantity,
      deliveryAvailable: input.deliveryAvailable,
      createdAt: now,
      updatedAt: now,
    };

    this.entries.set(entry.id, entry);
    return entry;
  }

  async update(
    id: string,
    input: UpdateSellerInventoryInput,
  ): Promise<SellerInventoryEntity | null> {
    const entry = this.entries.get(id);
    if (!entry) return null;

    if (input.city !== undefined) entry.city = input.city.trim();
    if (input.region !== undefined) entry.region = input.region?.trim() ?? null;
    if (input.price !== undefined) entry.price = Number(input.price).toFixed(2);
    if (input.quantity !== undefined) entry.quantity = input.quantity;
    if (input.deliveryAvailable !== undefined)
      entry.deliveryAvailable = input.deliveryAvailable;
    entry.updatedAt = new Date();

    return entry;
  }

  async delete(id: string): Promise<boolean> {
    return this.entries.delete(id);
  }

  getSellerInventoryQuantity(sellerId: string, productId: string): number {
    const entry = [...this.entries.values()].find(
      (e) => e.sellerId === sellerId && e.productId === productId,
    );
    return entry ? entry.quantity : 0;
  }
}
