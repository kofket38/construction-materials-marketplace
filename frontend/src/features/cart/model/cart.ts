import type { Product } from "@/features/products/model/product";

export interface CartItem {
  addedAt: string;
  availableQuantity: number;
  brandName: string | null;
  categoryId: string;
  categoryName: string;
  imageUrl: string | null;
  name: string;
  price: string;
  productId: string;
  quantity: number;
  sellerId: string;
  sellerName: string;
  updatedAt: string;
}

export type UserCarts = Record<string, CartItem[]>;

export interface CartMutationResult {
  message: string;
  productId?: string;
  quantity?: number;
  status: "error" | "limit" | "success";
}

export interface CartReconciliationResult {
  adjustedProductNames: string[];
  removedProductNames: string[];
}

/**
 * Returns the effective price for a product in the buyer's current city context.
 * When inventoryPrice is present (city-filtered result), it takes precedence
 * over the legacy catalog price so the buyer always sees the seller-specific price.
 */
export function effectivePrice(product: Product): string {
  return product.inventoryPrice ?? product.price;
}

/**
 * Returns the effective available stock for a product in the buyer's current
 * city context. Prefers the SellerInventory quantity over the legacy catalog
 * quantity when a city context is present.
 */
export function effectiveQuantity(product: Product): number {
  return product.inventoryQuantity ?? product.quantity;
}

export function createCartItem(
  product: Product,
  quantity: number,
): CartItem {
  const now = new Date().toISOString();
  const price = effectivePrice(product);
  const available = effectiveQuantity(product);

  return {
    addedAt: now,
    availableQuantity: Math.max(0, available),
    brandName: product.brand?.name ?? null,
    categoryId: product.categoryId,
    categoryName: product.category.name,
    imageUrl: product.imageUrl,
    name: product.name,
    price,
    productId: product.id,
    quantity,
    sellerId: product.sellerId,
    sellerName: product.seller.shopName || product.seller.name,
    updatedAt: now,
  };
}

export function updateCartItemProduct(
  item: CartItem,
  product: Product,
  quantity: number,
): CartItem {
  const price = effectivePrice(product);
  const available = effectiveQuantity(product);

  return {
    ...item,
    availableQuantity: Math.max(0, available),
    brandName: product.brand?.name ?? null,
    categoryId: product.categoryId,
    categoryName: product.category.name,
    imageUrl: product.imageUrl,
    name: product.name,
    price,
    quantity,
    sellerId: product.sellerId,
    sellerName: product.seller.shopName || product.seller.name,
    updatedAt: new Date().toISOString(),
  };
}
