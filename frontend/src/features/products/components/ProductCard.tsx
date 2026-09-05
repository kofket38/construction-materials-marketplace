import { ArrowRight, MapPin, Store } from "lucide-react";
import { Link } from "react-router-dom";

import type { Product } from "@/features/products/model/product";
import { effectivePrice, effectiveQuantity } from "@/features/cart/model/cart";
import { formatProductPrice } from "@/features/products/lib/product-display";
import { AddToCartButton } from "@/features/cart/components/AddToCartButton";
import { ProductImage } from "@/features/products/components/ProductImage";
import { StarRating } from "@/features/products/components/StarRating";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  // Use city-specific inventory values when present; fall back to catalog values.
  const displayPrice = effectivePrice(product);
  const displayQuantity = effectiveQuantity(product);
  const displayCity = product.inventoryCity ?? product.seller.city;
  const isInStock = displayQuantity > 0;
  const sellerName = product.seller.shopName || product.seller.name;

  // Preserve city in the "View Store" link so the store page opens pre-filtered.
  const storeHref = product.inventoryCity
    ? `/stores/${product.sellerId}?city=${encodeURIComponent(product.inventoryCity)}`
    : `/stores/${product.sellerId}`;

  return (
    <article className="flex min-h-full flex-col overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <Link
        aria-label={`View ${product.name}`}
        className="group flex aspect-[4/3] items-center justify-center overflow-hidden bg-sunken focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-ring"
        to={`/products/${product.id}`}
      >
        <ProductImage
          categoryName={product.category.name}
          className="transition-transform duration-300 group-hover:scale-[1.02]"
          imageUrl={product.imageUrl}
          name={product.name}
          size="md"
        />
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold uppercase text-brand-ink">
          {product.category.name}
        </p>
        <h2 className="mt-2 line-clamp-2 text-lg font-semibold leading-6 text-zinc-950">
          <Link
            className="transition-colors hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring"
            to={`/products/${product.id}`}
          >
            {product.name}
          </Link>
        </h2>
        <div className="mt-3 space-y-2 text-sm text-zinc-600">
          <p className="flex min-w-0 items-center gap-2">
            <Store aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate font-medium text-zinc-800">
              {sellerName}
            </span>
          </p>
          <p className="flex min-w-0 items-center gap-2">
            <MapPin aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">
              {displayCity || "City not provided"}
            </span>
          </p>
          {product.averageRating !== null &&
          product.averageRating !== undefined ? (
            <p className="flex items-center gap-2">
              <StarRating rating={product.averageRating} />
              <span>
                {product.averageRating.toFixed(1)}
                {product.reviewCount
                  ? ` (${product.reviewCount.toLocaleString()})`
                  : ""}
              </span>
            </p>
          ) : null}
        </div>

        <div className="mt-auto pt-5">
          {/* Show city-specific price badge when a city filter is active */}
          {product.inventoryCity ? (
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-ink">
              <MapPin aria-hidden="true" className="size-3" />
              {product.inventoryCity} price
            </div>
          ) : null}
          <p className="text-xl font-semibold text-zinc-950">
            {formatProductPrice(displayPrice)}
          </p>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs">
            <p className="text-zinc-500">Available stock</p>
            <p
              className={`shrink-0 font-semibold ${
                isInStock ? "text-success" : "text-danger"
              }`}
            >
              {isInStock
                ? `${displayQuantity.toLocaleString()} available`
                : "Out of stock"}
            </p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <AddToCartButton product={product} />
            <Link
              className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
              to={`/products/${product.id}`}
            >
              View Product
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link
              className="col-span-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-brand bg-white px-4 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-soft-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring"
              to={storeHref}
            >
              <Store aria-hidden="true" className="size-4" />
              View Store
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
