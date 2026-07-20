import type { ProductEntity } from "./product.repository.js";

export interface WishlistItemEntity {
  id: string;
  customerId: string;
  productId: string;
  product: ProductEntity;
  createdAt: Date;
}

export interface CreateWishlistItemInput {
  customerId: string;
  productId: string;
}

export interface WishlistRepository {
  create(input: CreateWishlistItemInput): Promise<WishlistItemEntity>;
  findByCustomerId(customerId: string): Promise<WishlistItemEntity[]>;
  delete(customerId: string, productId: string): Promise<boolean>;
}
