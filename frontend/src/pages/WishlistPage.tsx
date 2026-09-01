import {
  AlertTriangle,
  ArrowRight,
  Heart,
  LoaderCircle,
  Trash2,
} from "lucide-react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";

import {
  getWishlist,
  removeProductFromWishlist,
  type WishlistItem,
} from "@/features/products/api/product-actions.api";
import { effectivePrice, effectiveQuantity } from "@/features/cart/model/cart";
import { formatProductPrice } from "@/features/products/lib/product-display";
import { resolveLocalProductImage } from "@/features/products/lib/product-images";
import { useAuthStore } from "@/features/auth/model/auth.store";
import { isBuyerRole } from "@/features/auth/model/auth.types";
import { getApiErrorMessage } from "@/shared/api/http-error";

export function WishlistPage() {
  const authStatus = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const wishlistKey = ["wishlist", user?.id ?? "anonymous"] as const;

  const wishlistQuery = useQuery({
    queryKey: wishlistKey,
    enabled: authStatus === "authenticated" && isBuyerRole(user?.role),
    queryFn: ({ signal }) => getWishlist(signal),
  });

  const removeMutation = useMutation({
    mutationFn: (productId: string) => removeProductFromWishlist(productId),
    onSuccess: (_, productId) => {
      queryClient.setQueryData<WishlistItem[]>(
        wishlistKey,
        (current = []) =>
          current.filter((item) => item.productId !== productId),
      );
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: wishlistKey });
    },
  });

  if (authStatus !== "authenticated" || !user) {
    return (
      <Navigate replace state={{ returnTo: "/wishlist" }} to="/login" />
    );
  }
  if (!isBuyerRole(user.role)) {
    return <Navigate replace to="/products" />;
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Account</p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">
            My Wishlist
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Products you've saved for later.
          </p>
        </div>
        {wishlistQuery.data ? (
          <p className="text-sm text-zinc-600">
            {wishlistQuery.data.length.toLocaleString()}{" "}
            {wishlistQuery.data.length === 1 ? "item" : "items"}
          </p>
        ) : null}
      </div>

      {wishlistQuery.isPending ? (
        <div className="flex min-h-64 items-center justify-center">
          <LoaderCircle
            aria-hidden="true"
            className="size-6 animate-spin text-emerald-700"
          />
        </div>
      ) : wishlistQuery.isError ? (
        <div className="mt-8 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          <div>
            {getApiErrorMessage(
              wishlistQuery.error,
              "Your wishlist could not be loaded.",
            )}
            <button
              className="ml-2 font-semibold underline hover:no-underline"
              onClick={() => void wishlistQuery.refetch()}
              type="button"
            >
              Try again
            </button>
          </div>
        </div>
      ) : wishlistQuery.data.length === 0 ? (
        <section className="py-16 text-center">
          <Heart
            aria-hidden="true"
            className="mx-auto size-8 text-zinc-300"
            strokeWidth={1.5}
          />
          <h2 className="mt-4 text-lg font-semibold text-zinc-950">
            No saved products yet
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Tap the heart on any product to save it here.
          </p>
          <Link
            className="mt-6 inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            to="/products"
          >
            Browse products
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </section>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {wishlistQuery.data.map((item) => (
            <WishlistCard
              isRemoving={
                removeMutation.isPending &&
                removeMutation.variables === item.productId
              }
              item={item}
              key={item.id}
              onRemove={() => removeMutation.mutate(item.productId)}
            />
          ))}
        </div>
      )}

      {removeMutation.isError ? (
        <div
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg"
          role="alert"
        >
          {getApiErrorMessage(
            removeMutation.error,
            "The product could not be removed from your wishlist.",
          )}
        </div>
      ) : null}
    </main>
  );
}

function WishlistCard({
  isRemoving,
  item,
  onRemove,
}: {
  isRemoving: boolean;
  item: WishlistItem;
  onRemove: () => void;
}) {
  const product = item.product;
  const localImage = resolveLocalProductImage(product);
  const displayPrice = effectivePrice(product);
  const displayQuantity = effectiveQuantity(product);
  const isInStock = displayQuantity > 0;

  return (
    <article
      className={`flex flex-col rounded-md border border-zinc-200 bg-white shadow-sm transition-opacity ${
        isRemoving ? "opacity-50" : ""
      }`}
    >
      <Link
        aria-label={`View ${product.name}`}
        className="group block overflow-hidden rounded-t-md bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-700"
        to={`/products/${product.id}`}
      >
        {localImage.src ? (
          <img
            alt={product.name}
            className="aspect-[4/3] w-full object-contain p-4 transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
            src={localImage.src}
          />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center text-zinc-400">
            <Heart aria-hidden="true" className="size-10" strokeWidth={1.2} />
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-semibold uppercase text-emerald-700">
          {product.category.name}
        </p>
        <h2 className="mt-1.5 line-clamp-2 text-sm font-semibold leading-5 text-zinc-950">
          <Link
            className="hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            to={`/products/${product.id}`}
          >
            {product.name}
          </Link>
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          {product.seller.shopName || product.seller.name}
        </p>

        <div className="mt-auto pt-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-zinc-950">
                {formatProductPrice(displayPrice)}
              </p>
              <p
                className={`mt-0.5 text-xs font-semibold ${
                  isInStock ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {isInStock
                  ? `${displayQuantity.toLocaleString()} in stock`
                  : "Out of stock"}
              </p>
            </div>
            <button
              aria-label={`Remove ${product.name} from wishlist`}
              className="inline-flex size-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              disabled={isRemoving}
              onClick={onRemove}
              type="button"
            >
              {isRemoving ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Trash2 aria-hidden="true" className="size-4" />
              )}
            </button>
          </div>
          <Link
            className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
            to={`/products/${product.id}`}
          >
            View product
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
