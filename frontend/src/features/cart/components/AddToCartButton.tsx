import { Check, LoaderCircle, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  emptyCartItems,
  useCartStore,
} from "@/features/cart/model/cart.store";
import type { CartMutationResult } from "@/features/cart/model/cart";
import { effectiveQuantity } from "@/features/cart/model/cart";
import { useAuthStore } from "@/features/auth/model/auth.store";
import type { Product } from "@/features/products/model/product";

interface AddToCartButtonProps {
  className?: string;
  onResult?: (result: CartMutationResult) => void;
  product: Product;
  quantity?: number;
}

export function AddToCartButton({
  className,
  onResult,
  product,
  quantity = 1,
}: AddToCartButtonProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const authStatus = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const addItem = useCartStore((state) => state.addItem);
  const hydrationStatus = useCartStore((state) => state.hydrationStatus);
  const cartItems = useCartStore((state) =>
    user ? (state.cartsByUserId[user.id] ?? emptyCartItems) : emptyCartItems,
  );
  const [isAdding, setIsAdding] = useState(false);
  const [wasAdded, setWasAdded] = useState(false);
  const currentQuantity =
    cartItems.find((item) => item.productId === product.id)?.quantity ?? 0;
  // Use city-specific stock when available; fall back to catalog quantity.
  const availableStock = effectiveQuantity(product);
  const inventoryLimitReached =
    availableStock > 0 && currentQuantity >= availableStock;
  const isDisabled =
    isAdding ||
    hydrationStatus !== "ready" ||
    availableStock < 1 ||
    inventoryLimitReached;

  async function handleAddToCart(): Promise<void> {
    setWasAdded(false);

    if (authStatus !== "authenticated" || !user) {
      navigate("/login", {
        state: {
          returnTo: `${location.pathname}${location.search}`,
        },
      });
      return;
    }

    if (user.role !== "CUSTOMER") {
      onResult?.({
        message: "Shopping cart actions are available to customer accounts.",
        productId: product.id,
        status: "error",
      });
      return;
    }

    setIsAdding(true);
    try {
      const result = await addItem(user.id, product, quantity);
      setWasAdded(result.status === "success" || result.status === "limit");
      onResult?.(result);
    } finally {
      setIsAdding(false);
    }
  }

  const label =
    hydrationStatus === "error"
      ? "Cart unavailable"
      : hydrationStatus !== "ready"
        ? "Loading cart..."
        : availableStock < 1
      ? "Out of stock"
      : inventoryLimitReached
        ? "Inventory limit reached"
        : isAdding
          ? "Adding..."
          : wasAdded
            ? "Added to cart"
            : "Add to cart";

  return (
    <button
      className={
        className ??
        "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:opacity-55"
      }
      disabled={isDisabled}
      onClick={() => void handleAddToCart()}
      type="button"
    >
      {isAdding ? (
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      ) : wasAdded ? (
        <Check aria-hidden="true" className="size-4" />
      ) : (
        <ShoppingCart aria-hidden="true" className="size-4" />
      )}
      {label}
    </button>
  );
}
