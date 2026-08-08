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

export function createCartItem(
  product: Product,
  quantity: number,
): CartItem {
  const now = new Date().toISOString();

  return {
    addedAt: now,
    availableQuantity: Math.max(0, product.quantity),
    brandName: product.brand?.name ?? null,
    categoryId: product.categoryId,
    categoryName: product.category.name,
    imageUrl: product.imageUrl,
    name: product.name,
    price: product.price,
    productId: product.id,
    quantity,
    sellerName: product.seller.shopName || product.seller.name,
    updatedAt: now,
  };
}

export function updateCartItemProduct(
  item: CartItem,
  product: Product,
  quantity: number,
): CartItem {
  return {
    ...item,
    availableQuantity: Math.max(0, product.quantity),
    brandName: product.brand?.name ?? null,
    categoryId: product.categoryId,
    categoryName: product.category.name,
    imageUrl: product.imageUrl,
    name: product.name,
    price: product.price,
    quantity,
    sellerName: product.seller.shopName || product.seller.name,
    updatedAt: new Date().toISOString(),
  };
}
