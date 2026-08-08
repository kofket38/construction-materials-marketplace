import {
  ArrowRight,
  Cable,
  Construction,
  Droplets,
  ImageOff,
  MapPin,
  PaintBucket,
  Store,
  Warehouse,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import type { Product } from "@/features/products/model/product";
import { formatProductPrice } from "@/features/products/lib/product-display";
import { resolveLocalProductImage } from "@/features/products/lib/product-images";
import { AddToCartButton } from "@/features/cart/components/AddToCartButton";
import { StarRating } from "@/features/products/components/StarRating";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const localImage = resolveLocalProductImage(product);
  const [imageSource] = useState<string | null>(localImage.src);
  const [imageFailed, setImageFailed] = useState(false);
  const isInStock = product.quantity > 0;
  const sellerName = product.seller.shopName || product.seller.name;

  function handleImageError(): void {
    setImageFailed(true);
  }

  return (
    <article className="flex min-h-full flex-col overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <Link
        aria-label={`View ${product.name}`}
        className="group flex aspect-[4/3] items-center justify-center overflow-hidden bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-700"
        to={`/products/${product.id}`}
      >
        {!imageFailed && imageSource ? (
          <img
            alt={product.name}
            className="h-full w-full object-contain p-4 transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
            onError={handleImageError}
            src={imageSource}
          />
        ) : (
          <ProductVisualPlaceholder category={product.category.name} />
        )}
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold uppercase text-emerald-700">
          {product.category.name}
        </p>
        <h2 className="mt-2 line-clamp-2 text-lg font-semibold leading-6 text-zinc-950">
          <Link
            className="transition-colors hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
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
              {product.seller.city || "City not provided"}
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
          <p className="text-xl font-semibold text-zinc-950">
            {formatProductPrice(product.price)}
          </p>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs">
            <p className="text-zinc-500">Available stock</p>
            <p
              className={`shrink-0 font-semibold ${
                isInStock ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {isInStock
                ? `${product.quantity.toLocaleString()} available`
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
              className="col-span-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-emerald-700 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              to={`/stores/${product.sellerId}`}
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

function ProductVisualPlaceholder({ category }: { category: string }) {
  const normalizedCategory = category.toLowerCase();
  const Icon = normalizedCategory.includes("electrical")
    ? Cable
    : normalizedCategory.includes("plumbing")
      ? Droplets
      : normalizedCategory.includes("paint")
        ? PaintBucket
        : normalizedCategory.includes("aggregate")
          ? Warehouse
          : normalizedCategory.includes("steel") ||
              normalizedCategory.includes("roofing")
            ? Construction
            : ImageOff;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-zinc-100 text-zinc-500">
      <Icon aria-hidden="true" className="size-12" strokeWidth={1.35} />
      <span className="px-4 text-center text-xs font-semibold uppercase">
        {category}
      </span>
    </div>
  );
}
