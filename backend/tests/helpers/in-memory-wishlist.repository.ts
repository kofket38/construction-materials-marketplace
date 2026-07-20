import { randomUUID } from "node:crypto";
import {
  DuplicateWishlistItemError,
  WishlistProductNotFoundError,
} from "../../src/repositories/wishlist.errors.js";
import type {
  CreateWishlistItemInput,
  WishlistItemEntity,
  WishlistRepository,
} from "../../src/repositories/wishlist.repository.js";
import type { ProductEntity } from "../../src/repositories/product.repository.js";

export class InMemoryWishlistRepository implements WishlistRepository {
  private readonly products = new Map<string, ProductEntity>();
  private readonly items = new Map<string, WishlistItemEntity>();

  addProduct(product: ProductEntity): void {
    this.products.set(product.id, product);
  }

  setCreatedAt(
    customerId: string,
    productId: string,
    createdAt: Date,
  ): void {
    const item = this.items.get(wishlistKey(customerId, productId));
    if (!item) {
      throw new Error(
        `Test wishlist item ${customerId}:${productId} was not found.`,
      );
    }
    item.createdAt = createdAt;
  }

  async create(
    input: CreateWishlistItemInput,
  ): Promise<WishlistItemEntity> {
    const product = this.products.get(input.productId);
    if (!product) {
      throw new WishlistProductNotFoundError();
    }

    const key = wishlistKey(input.customerId, input.productId);
    if (this.items.has(key)) {
      throw new DuplicateWishlistItemError();
    }

    const item: WishlistItemEntity = {
      id: randomUUID(),
      customerId: input.customerId,
      productId: input.productId,
      product,
      createdAt: new Date(),
    };
    this.items.set(key, item);
    return item;
  }

  async findByCustomerId(
    customerId: string,
  ): Promise<WishlistItemEntity[]> {
    return [...this.items.values()]
      .filter((item) => item.customerId === customerId)
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          left.id.localeCompare(right.id),
      );
  }

  async delete(customerId: string, productId: string): Promise<boolean> {
    return this.items.delete(wishlistKey(customerId, productId));
  }
}

function wishlistKey(customerId: string, productId: string): string {
  return `${customerId}:${productId}`;
}
