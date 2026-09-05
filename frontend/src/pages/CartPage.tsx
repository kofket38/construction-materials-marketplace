import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  LoaderCircle,
  RotateCcw,
  ShoppingBag,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuthStore } from "@/features/auth/model/auth.store";
import { isBuyerRole } from "@/features/auth/model/auth.types";
import { refreshCartProducts } from "@/features/cart/api/cart-products.api";
import { CartItemRow } from "@/features/cart/components/CartItemRow";
import { ConfirmCartActionDialog } from "@/features/cart/components/ConfirmCartActionDialog";
import {
  calculateCartSubtotal,
  formatCartAmount,
} from "@/features/cart/lib/cart-pricing";
import type { CartItem } from "@/features/cart/model/cart";
import {
  emptyCartItems,
  getCartItemCount,
  useCartStore,
} from "@/features/cart/model/cart.store";
import { getApiErrorMessage } from "@/shared/api/http-error";

type PendingConfirmation =
  | { item: CartItem; type: "remove" }
  | { type: "clear" }
  | null;

export function CartPage() {
  const navigate = useNavigate();
  const authStatus = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const userId = user?.id ?? null;
  const hydrationStatus = useCartStore((state) => state.hydrationStatus);
  const hydrationError = useCartStore((state) => state.hydrationError);
  const persistenceError = useCartStore((state) => state.persistenceError);
  const isPersisting = useCartStore((state) => state.isPersisting);
  const items = useCartStore((state) =>
    userId
      ? (state.cartsByUserId[userId] ?? emptyCartItems)
      : emptyCartItems,
  );
  const clearCart = useCartStore((state) => state.clearCart);
  const hydrate = useCartStore((state) => state.hydrate);
  const reconcileCart = useCartStore((state) => state.reconcileCart);
  const removeItem = useCartStore((state) => state.removeItem);
  const resetStorage = useCartStore((state) => state.resetStorage);
  const retryPersistence = useCartStore(
    (state) => state.retryPersistence,
  );
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const productIds = useMemo(
    () => items.map((item) => item.productId).sort(),
    [items],
  );
  // PROFESSIONAL accounts are buyer-capable and share the customer cart.
  const isCustomer =
    authStatus === "authenticated" && isBuyerRole(user?.role);

  const cartProductsQuery = useQuery({
    queryKey: ["cart", "products", userId, productIds],
    enabled:
      Boolean(userId) &&
      isCustomer &&
      hydrationStatus === "ready" &&
      productIds.length > 0,
    queryFn: ({ signal }) => refreshCartProducts(productIds, signal),
    retry: 1,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!userId || !cartProductsQuery.data) {
      return;
    }

    let isCancelled = false;
    void reconcileCart(
      userId,
      cartProductsQuery.data.products,
      cartProductsQuery.data.unavailableProductIds,
    ).then((result) => {
      if (isCancelled) {
        return;
      }

      const messages: string[] = [];
      if (result.removedProductNames.length > 0) {
        messages.push(
          `${result.removedProductNames.length} unavailable ${
            result.removedProductNames.length === 1 ? "item was" : "items were"
          } removed from your cart.`,
        );
      }
      if (result.adjustedProductNames.length > 0) {
        messages.push(
          `${result.adjustedProductNames.length} ${
            result.adjustedProductNames.length === 1
              ? "quantity was"
              : "quantities were"
          } adjusted to current inventory.`,
        );
      }
      if (messages.length > 0) {
        setMessage(messages.join(" "));
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [cartProductsQuery.data, reconcileCart, userId]);

  const itemCount = getCartItemCount(items);
  const subtotal = calculateCartSubtotal(items);
  const canProceed =
    items.length > 0 &&
    cartProductsQuery.isSuccess &&
    !isPersisting &&
    !persistenceError;

  async function handleQuantityChange(
    item: CartItem,
    quantity: number,
  ): Promise<void> {
    if (!userId) {
      return;
    }

    const result = await updateQuantity(userId, item.productId, quantity);
    setMessage(result.status === "limit" ? result.message : null);
  }

  async function confirmPendingAction(): Promise<void> {
    if (!userId || !pendingConfirmation) {
      return;
    }

    setIsConfirming(true);
    try {
      if (pendingConfirmation.type === "remove") {
        await removeItem(userId, pendingConfirmation.item.productId);
        setMessage(`${pendingConfirmation.item.name} was removed.`);
      } else {
        await clearCart(userId);
        setMessage("Your cart was cleared.");
      }
      setPendingConfirmation(null);
    } finally {
      setIsConfirming(false);
    }
  }

  if (authStatus !== "authenticated" || !user) {
    return <CartAccessState />;
  }

  if (!isBuyerRole(user.role)) {
    return (
      <CartAccessState
        description="Shopping cart actions are available to customer and professional accounts."
        showSignIn={false}
        title="Buyer account required"
      />
    );
  }

  if (hydrationStatus === "idle" || hydrationStatus === "loading") {
    return <CartLoadingState />;
  }

  if (hydrationStatus === "error") {
    return (
      <CartStorageError
        description={
          hydrationError ?? "The saved cart could not be loaded."
        }
        onReset={() => void resetStorage()}
        onRetry={() => void hydrate()}
      />
    );
  }

  if (items.length === 0) {
    return <EmptyCartState message={message} />;
  }

  return (
    <>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-brand-ink">
              Shopping cart
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-zinc-950">
              Review your materials
            </h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              {itemCount.toLocaleString()}{" "}
              {itemCount === 1 ? "item" : "items"} across{" "}
              {items.length.toLocaleString()}{" "}
              {items.length === 1 ? "product" : "products"}
            </p>
          </div>
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isPersisting}
            onClick={() => setPendingConfirmation({ type: "clear" })}
            type="button"
          >
            <Trash2 aria-hidden="true" className="size-4" />
            Clear cart
          </button>
        </div>

        {cartProductsQuery.isPending ? (
          <div
            aria-live="polite"
            className="mt-6 flex items-center gap-3 border-y border-zinc-200 py-3 text-sm text-zinc-600"
          >
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin text-brand-ink"
            />
            Checking current prices and inventory...
          </div>
        ) : null}

        {cartProductsQuery.isError ? (
          <StatusBanner tone="error">
            <AlertTriangle aria-hidden="true" className="size-5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">Inventory refresh failed</p>
              <p className="mt-1">
                {getApiErrorMessage(
                  cartProductsQuery.error,
                  "Current prices and stock could not be confirmed.",
                )}
              </p>
            </div>
            <button
              className="ml-auto inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
              onClick={() => void cartProductsQuery.refetch()}
              type="button"
            >
              <RotateCcw aria-hidden="true" className="size-3.5" />
              Retry
            </button>
          </StatusBanner>
        ) : null}

        {persistenceError ? (
          <StatusBanner tone="error">
            <AlertTriangle aria-hidden="true" className="size-5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">Cart not saved</p>
              <p className="mt-1">{persistenceError}</p>
            </div>
            <button
              className="ml-auto inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
              onClick={() => void retryPersistence()}
              type="button"
            >
              <RotateCcw aria-hidden="true" className="size-3.5" />
              Retry
            </button>
          </StatusBanner>
        ) : null}

        {message ? (
          <StatusBanner tone="info">
            <ShoppingCart aria-hidden="true" className="size-5 shrink-0" />
            <p>{message}</p>
          </StatusBanner>
        ) : null}

        <div className="mt-7 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section aria-label="Cart items" className="space-y-4">
            {items.map((item) => (
              <CartItemRow
                item={item}
                key={item.productId}
                onRemove={(selectedItem) =>
                  setPendingConfirmation({
                    item: selectedItem,
                    type: "remove",
                  })
                }
                onUpdateQuantity={(selectedItem, quantity) =>
                  void handleQuantityChange(selectedItem, quantity)
                }
                quantityDisabled={
                  isPersisting || !cartProductsQuery.isSuccess
                }
                removeDisabled={isPersisting}
              />
            ))}
          </section>

          <aside className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <h2 className="text-lg font-semibold text-zinc-950">
              Order summary
            </h2>
            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-zinc-600">Cart subtotal</dt>
                <dd className="font-semibold text-zinc-950">
                  {formatCartAmount(subtotal)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-zinc-600">Estimated delivery</dt>
                <dd className="max-w-32 text-right font-medium text-zinc-600">
                  Calculated at checkout
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4 border-t border-zinc-200 pt-4">
                <dt className="font-semibold text-zinc-950">Grand total</dt>
                <dd className="text-lg font-semibold text-zinc-950">
                  {formatCartAmount(subtotal)}
                </dd>
              </div>
            </dl>

            <button
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-3 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring disabled:cursor-not-allowed disabled:opacity-55"
              disabled={!canProceed}
              onClick={() => navigate("/checkout")}
              type="button"
            >
              <ShoppingBag aria-hidden="true" className="size-5" />
              Proceed to checkout
            </button>
            <Link
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
              to="/products"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Continue shopping
            </Link>
          </aside>
        </div>
      </main>

      <ConfirmCartActionDialog
        actionLabel={
          pendingConfirmation?.type === "clear"
            ? "Clear cart"
            : "Remove item"
        }
        description={
          pendingConfirmation?.type === "remove"
            ? `Remove ${pendingConfirmation.item.name} from your cart?`
            : "Remove every product from your cart? This action cannot be undone."
        }
        isOpen={pendingConfirmation !== null}
        isPending={isConfirming}
        onCancel={() => setPendingConfirmation(null)}
        onConfirm={() => void confirmPendingAction()}
        title={
          pendingConfirmation?.type === "clear"
            ? "Clear your cart?"
            : "Remove this item?"
        }
      />
    </>
  );
}

function CartAccessState({
  description = "Sign in with a customer account to view and manage your saved cart.",
  showSignIn = true,
  title = "Sign in to view your cart",
}: {
  description?: string;
  showSignIn?: boolean;
  title?: string;
}) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
      <section className="max-w-lg">
        <ShoppingCart
          aria-hidden="true"
          className="size-10 text-brand-ink"
          strokeWidth={1.5}
        />
        <h1 className="mt-5 text-3xl font-semibold text-zinc-950">
          {title}
        </h1>
        <p className="mt-3 text-base leading-7 text-zinc-600">
          {description}
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          {showSignIn ? (
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
              state={{ returnTo: "/cart" }}
              to="/login"
            >
              Sign in
            </Link>
          ) : null}
          <Link
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
            to="/products"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Continue shopping
          </Link>
        </div>
      </section>
    </main>
  );
}

function CartLoadingState() {
  return (
    <main
      aria-live="polite"
      className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16"
    >
      <div className="text-center">
        <LoaderCircle
          aria-hidden="true"
          className="mx-auto size-8 animate-spin text-brand-ink"
        />
        <p className="mt-4 text-sm font-medium text-zinc-600">
          Loading your saved cart...
        </p>
      </div>
    </main>
  );
}

function CartStorageError({
  description,
  onReset,
  onRetry,
}: {
  description: string;
  onReset: () => void;
  onRetry: () => void;
}) {
  return (
    <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
      <section className="max-w-md text-center">
        <AlertTriangle
          aria-hidden="true"
          className="mx-auto size-9 text-red-700"
          strokeWidth={1.6}
        />
        <h1 className="mt-5 text-2xl font-semibold text-zinc-950">
          Unable to load your cart
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          {description}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
            onClick={onRetry}
            type="button"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            Try again
          </button>
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            onClick={onReset}
            type="button"
          >
            Reset saved cart
          </button>
        </div>
      </section>
    </main>
  );
}

function EmptyCartState({ message }: { message: string | null }) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <section className="max-w-lg text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-md bg-brand-soft text-brand-ink">
          <ShoppingCart aria-hidden="true" className="size-7" />
        </span>
        <h1 className="mt-6 text-3xl font-semibold text-zinc-950">
          Your cart is empty
        </h1>
        <p className="mt-3 text-base leading-7 text-zinc-600">
          Browse the marketplace and add the materials needed for your
          project.
        </p>
        {message ? (
          <p aria-live="polite" className="mt-3 text-sm text-zinc-500">
            {message}
          </p>
        ) : null}
        <Link
          className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
          to="/products"
        >
          Browse products
        </Link>
      </section>
    </main>
  );
}

function StatusBanner({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "error" | "info";
}) {
  return (
    <div
      aria-live="polite"
      className={`mt-4 flex flex-wrap items-start gap-3 rounded-md border px-4 py-3 text-sm ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-brand-line bg-brand-soft text-brand-ink"
      }`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
