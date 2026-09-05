import {
  Heart,
  LoaderCircle,
  MapPin,
  MessageSquareQuote,
  PackageCheck,
  PackageX,
  Store,
} from "lucide-react";
import { useState } from "react";

import { AddToCartButton } from "@/features/cart/components/AddToCartButton";
import { QuantityControl } from "@/features/cart/components/QuantityControl";
import type { CartMutationResult } from "@/features/cart/model/cart";
import { StarRating } from "@/features/products/components/StarRating";
import {
  formatProductAvailability,
  formatProductPrice,
  getProductBrand,
  getProductDeliveryStatus,
  getProductLocation,
  getProductMinimumOrder,
  missingProductValue,
} from "@/features/products/lib/product-display";
import type { ProductDetails } from "@/features/products/model/product";

interface ProductInfoProps {
  actionMessage: string | null;
  isWishlistPending: boolean;
  isWishlisted: boolean;
  onCartResult: (result: CartMutationResult) => void;
  onRequestQuote: () => void;
  onShowReviews: () => void;
  onToggleWishlist: () => void;
  product: ProductDetails;
}

export function ProductInfo({
  actionMessage,
  isWishlistPending,
  isWishlisted,
  onCartResult,
  onRequestQuote,
  onShowReviews,
  onToggleWishlist,
  product,
}: ProductInfoProps) {
  const isInStock = product.quantity > 0;
  const location = getProductLocation(product);
  const [cartQuantity, setCartQuantity] = useState(1);

  return (
    <section aria-labelledby="product-name" className="min-w-0">
      <p className="text-sm font-semibold text-brand-ink">
        {product.category.name}
      </p>
      <h1
        className="mt-2 text-3xl font-semibold leading-tight text-zinc-950 sm:text-4xl"
        id="product-name"
      >
        {product.name}
      </h1>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-zinc-600">
        <p className="inline-flex min-w-0 items-center gap-2">
          <Store aria-hidden="true" className="size-4 shrink-0 text-zinc-500" />
          <span className="truncate">
            Sold by{" "}
            <span className="font-semibold text-zinc-900">
              {product.seller.shopName || product.seller.name}
            </span>
          </span>
        </p>
        {location !== missingProductValue ? (
          <p className="inline-flex items-center gap-2">
            <MapPin
              aria-hidden="true"
              className="size-4 shrink-0 text-zinc-500"
            />
            {location}
          </p>
        ) : null}
      </div>

      <button
        className="mt-4 inline-flex items-center gap-2 rounded-sm text-sm text-zinc-600 transition-colors hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring"
        onClick={onShowReviews}
        type="button"
      >
        <StarRating rating={product.averageRating ?? 0} />
        {product.averageRating === null ? (
          <span>No reviews yet</span>
        ) : (
          <span>
            <span className="font-semibold text-zinc-950">
              {product.averageRating.toFixed(1)}
            </span>{" "}
            ({product.reviewCount.toLocaleString()}{" "}
            {product.reviewCount === 1 ? "review" : "reviews"})
          </span>
        )}
      </button>

      <div className="mt-6 border-y border-zinc-200 py-6">
        <p className="text-3xl font-semibold text-zinc-950">
          {formatProductPrice(product.price)}
        </p>
        <p
          className={`mt-3 inline-flex items-center gap-2 text-sm font-semibold ${
            isInStock ? "text-success" : "text-danger"
          }`}
        >
          {isInStock ? (
            <PackageCheck aria-hidden="true" className="size-5" />
          ) : (
            <PackageX aria-hidden="true" className="size-5" />
          )}
          {formatProductAvailability(product)}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-b border-zinc-200 py-6 text-sm">
        <ProductFact label="Brand" value={getProductBrand(product)} />
        <ProductFact
          label="Weight"
          value={product.weight?.trim() || missingProductValue}
        />
        <ProductFact
          label="Packaging"
          value={product.packaging?.trim() || missingProductValue}
        />
        <ProductFact
          label="Minimum order"
          value={getProductMinimumOrder(product)}
        />
        <ProductFact label="Location" value={location} />
        <ProductFact
          label="Delivery"
          value={getProductDeliveryStatus(product)}
        />
      </dl>

      <div className="mt-6">
        <p className="text-sm font-medium text-zinc-800">Quantity</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <QuantityControl
            disabled={!isInStock}
            label={`Quantity to add for ${product.name}`}
            max={product.quantity}
            onChange={setCartQuantity}
            value={cartQuantity}
          />
          <AddToCartButton
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:opacity-55"
            onResult={onCartResult}
            product={product}
            quantity={cartQuantity}
          />
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <button
          aria-pressed={isWishlisted}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-brand bg-white px-4 py-3 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-soft-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isWishlistPending}
          onClick={onToggleWishlist}
          type="button"
        >
          {isWishlistPending ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-5 animate-spin"
            />
          ) : (
            <Heart
              aria-hidden="true"
              className={`size-5 ${isWishlisted ? "fill-brand" : ""}`}
            />
          )}
          {isWishlisted ? "Saved to wishlist" : "Add to wishlist"}
        </button>
        <button
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-brand px-4 py-3 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring"
          onClick={onRequestQuote}
          type="button"
        >
          <MessageSquareQuote aria-hidden="true" className="size-5" />
          Request quote
        </button>
      </div>

      {actionMessage ? (
        <p
          aria-live="polite"
          className="mt-3 text-sm leading-6 text-zinc-600"
        >
          {actionMessage}
        </p>
      ) : null}
    </section>
  );
}

function ProductFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="mt-1 break-words font-semibold text-zinc-900">
        {value}
      </dd>
    </div>
  );
}
