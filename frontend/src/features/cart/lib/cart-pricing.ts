import type { CartItem } from "@/features/cart/model/cart";
import { formatProductPrice } from "@/features/products/lib/product-display";

export function calculateItemSubtotal(item: CartItem): number {
  return Number(item.price) * item.quantity;
}

export function calculateCartSubtotal(items: CartItem[]): number {
  return items.reduce(
    (subtotal, item) => subtotal + calculateItemSubtotal(item),
    0,
  );
}

export function formatCartAmount(amount: number): string {
  return formatProductPrice(amount.toFixed(2));
}
