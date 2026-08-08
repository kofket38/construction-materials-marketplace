import { z } from "zod";

import type { CartRepository } from "@/features/cart/data/cart.repository";
import type { UserCarts } from "@/features/cart/model/cart";

const CART_STORAGE_KEY = "cmm-marketplace-cart-v1";
const CART_STORAGE_VERSION = 1;

const cartItemSchema = z
  .object({
    addedAt: z.string(),
    availableQuantity: z.number().int().min(0),
    brandName: z.string().nullable(),
    categoryId: z.string(),
    categoryName: z.string(),
    imageUrl: z.string().nullable(),
    name: z.string(),
    price: z.string(),
    productId: z.string(),
    quantity: z.number().int().min(1),
    sellerName: z.string(),
    updatedAt: z.string(),
  })
  .strict();

const persistedCartSchema = z
  .object({
    cartsByUserId: z.record(z.string(), z.array(cartItemSchema)),
    version: z.literal(CART_STORAGE_VERSION),
  })
  .strict();

class LocalCartRepository implements CartRepository {
  async clear(): Promise<void> {
    window.localStorage.removeItem(CART_STORAGE_KEY);
  }

  async load(): Promise<UserCarts> {
    const storedValue = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!storedValue) {
      return {};
    }

    let parsedValue: unknown;
    try {
      parsedValue = JSON.parse(storedValue);
    } catch {
      throw new Error("The saved cart data is not valid JSON.");
    }

    const result = persistedCartSchema.safeParse(parsedValue);
    if (!result.success) {
      throw new Error("The saved cart data is invalid or unsupported.");
    }

    return result.data.cartsByUserId;
  }

  async save(cartsByUserId: UserCarts): Promise<void> {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({
        cartsByUserId,
        version: CART_STORAGE_VERSION,
      }),
    );
  }
}

export const cartRepository: CartRepository = new LocalCartRepository();
