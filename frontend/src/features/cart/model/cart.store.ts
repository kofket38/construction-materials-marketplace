import { create } from "zustand";

import { cartRepository } from "@/features/cart/data/local-cart.repository";
import {
  createCartItem,
  updateCartItemProduct,
  type CartItem,
  type CartMutationResult,
  type CartReconciliationResult,
  type UserCarts,
} from "@/features/cart/model/cart";
import type { Product } from "@/features/products/model/product";

export type CartHydrationStatus = "error" | "idle" | "loading" | "ready";

interface CartState {
  cartsByUserId: UserCarts;
  hydrationError: string | null;
  hydrationStatus: CartHydrationStatus;
  isPersisting: boolean;
  persistenceError: string | null;
}

interface CartActions {
  addItem: (
    userId: string,
    product: Product,
    quantity?: number,
  ) => Promise<CartMutationResult>;
  clearCart: (userId: string) => Promise<void>;
  hydrate: () => Promise<void>;
  reconcileCart: (
    userId: string,
    products: Product[],
    unavailableProductIds: string[],
  ) => Promise<CartReconciliationResult>;
  removeItem: (userId: string, productId: string) => Promise<void>;
  resetStorage: () => Promise<void>;
  retryPersistence: () => Promise<void>;
  updateQuantity: (
    userId: string,
    productId: string,
    quantity: number,
  ) => Promise<CartMutationResult>;
}

const initialState: CartState = {
  cartsByUserId: {},
  hydrationError: null,
  hydrationStatus: "idle",
  isPersisting: false,
  persistenceError: null,
};

let hydrationRequest: Promise<void> | null = null;

export const useCartStore = create<CartState & CartActions>()((set, get) => {
  async function persistCurrentState(): Promise<void> {
    set({ isPersisting: true, persistenceError: null });

    try {
      await cartRepository.save(get().cartsByUserId);
    } catch (error) {
      set({
        persistenceError: getErrorMessage(
          error,
          "The cart could not be saved on this device.",
        ),
      });
    } finally {
      set({ isPersisting: false });
    }
  }

  return {
    ...initialState,
    addItem: async (userId, product, requestedQuantity = 1) => {
      if (product.quantity < 1) {
        return {
          message: `${product.name} is currently out of stock.`,
          productId: product.id,
          status: "error",
        };
      }

      const currentItems = get().cartsByUserId[userId] ?? [];
      const existingItem = currentItems.find(
        (item) => item.productId === product.id,
      );
      const quantityToAdd = normalizeRequestedQuantity(requestedQuantity);
      const nextQuantity = Math.min(
        (existingItem?.quantity ?? 0) + quantityToAdd,
        product.quantity,
      );

      if (existingItem && nextQuantity === existingItem.quantity) {
        return {
          message: `Only ${product.quantity.toLocaleString()} units are available.`,
          productId: product.id,
          quantity: existingItem.quantity,
          status: "limit",
        };
      }

      const nextItem = existingItem
        ? updateCartItemProduct(existingItem, product, nextQuantity)
        : createCartItem(product, nextQuantity);
      const nextItems = existingItem
        ? currentItems.map((item) =>
            item.productId === product.id ? nextItem : item,
          )
        : [...currentItems, nextItem];

      set((state) => ({
        cartsByUserId: {
          ...state.cartsByUserId,
          [userId]: nextItems,
        },
      }));
      await persistCurrentState();

      return {
        message:
          nextQuantity < (existingItem?.quantity ?? 0) + quantityToAdd
            ? `${product.name} was added up to the available inventory limit.`
            : `${product.name} was added to your cart.`,
        productId: product.id,
        quantity: nextQuantity,
        status:
          nextQuantity < (existingItem?.quantity ?? 0) + quantityToAdd
            ? "limit"
            : "success",
      };
    },
    clearCart: async (userId) => {
      set((state) => ({
        cartsByUserId: {
          ...state.cartsByUserId,
          [userId]: [],
        },
      }));
      await persistCurrentState();
    },
    hydrate: async () => {
      if (get().hydrationStatus === "ready") {
        return;
      }
      if (hydrationRequest) {
        return hydrationRequest;
      }

      hydrationRequest = (async () => {
        set({
          hydrationError: null,
          hydrationStatus: "loading",
        });

        try {
          const cartsByUserId = await cartRepository.load();
          set({
            cartsByUserId,
            hydrationError: null,
            hydrationStatus: "ready",
          });
        } catch (error) {
          set({
            hydrationError: getErrorMessage(
              error,
              "The saved cart could not be loaded.",
            ),
            hydrationStatus: "error",
          });
        }
      })().finally(() => {
        hydrationRequest = null;
      });

      return hydrationRequest;
    },
    reconcileCart: async (
      userId,
      products,
      unavailableProductIds,
    ) => {
      const productById = new Map(
        products.map((product) => [product.id, product]),
      );
      const unavailableIds = new Set(unavailableProductIds);
      const adjustedProductNames: string[] = [];
      const removedProductNames: string[] = [];
      const currentItems = get().cartsByUserId[userId] ?? [];
      const nextItems = currentItems.flatMap((item) => {
        const product = productById.get(item.productId);
        if (
          unavailableIds.has(item.productId) ||
          (product && product.quantity < 1)
        ) {
          removedProductNames.push(item.name);
          return [];
        }
        if (!product) {
          return [item];
        }

        const quantity = Math.min(item.quantity, product.quantity);
        if (quantity !== item.quantity) {
          adjustedProductNames.push(item.name);
        }

        return [updateCartItemProduct(item, product, quantity)];
      });

      set((state) => ({
        cartsByUserId: {
          ...state.cartsByUserId,
          [userId]: nextItems,
        },
      }));
      await persistCurrentState();

      return {
        adjustedProductNames,
        removedProductNames,
      };
    },
    removeItem: async (userId, productId) => {
      set((state) => ({
        cartsByUserId: {
          ...state.cartsByUserId,
          [userId]: (state.cartsByUserId[userId] ?? []).filter(
            (item) => item.productId !== productId,
          ),
        },
      }));
      await persistCurrentState();
    },
    resetStorage: async () => {
      try {
        await cartRepository.clear();
        set({
          ...initialState,
          hydrationStatus: "ready",
        });
      } catch (error) {
        set({
          hydrationError: getErrorMessage(
            error,
            "The saved cart could not be reset.",
          ),
          hydrationStatus: "error",
        });
      }
    },
    retryPersistence: async () => {
      await persistCurrentState();
    },
    updateQuantity: async (userId, productId, requestedQuantity) => {
      const currentItems = get().cartsByUserId[userId] ?? [];
      const item = currentItems.find(
        (candidate) => candidate.productId === productId,
      );
      if (!item) {
        return {
          message: "This product is no longer in your cart.",
          productId,
          status: "error",
        };
      }

      const normalizedRequest = normalizeRequestedQuantity(requestedQuantity);
      const normalizedQuantity = Math.max(
        1,
        Math.min(normalizedRequest, item.availableQuantity),
      );
      const status =
        normalizedQuantity !== requestedQuantity ||
        normalizedRequest !== requestedQuantity
          ? "limit"
          : "success";

      set((state) => ({
        cartsByUserId: {
          ...state.cartsByUserId,
          [userId]: currentItems.map((candidate) =>
            candidate.productId === productId
              ? {
                  ...candidate,
                  quantity: normalizedQuantity,
                  updatedAt: new Date().toISOString(),
                }
              : candidate,
          ),
        },
      }));
      await persistCurrentState();

      return {
        message:
          status === "limit"
            ? `Quantity must be between 1 and ${item.availableQuantity.toLocaleString()}.`
            : `${item.name} quantity updated.`,
        productId,
        quantity: normalizedQuantity,
        status,
      };
    },
  };
});

export const emptyCartItems: CartItem[] = [];

export function getCartItemCount(items: CartItem[]): number {
  return items.reduce((count, item) => count + item.quantity, 0);
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function normalizeRequestedQuantity(quantity: number): number {
  return Number.isFinite(quantity) ? Math.max(1, Math.floor(quantity)) : 1;
}
