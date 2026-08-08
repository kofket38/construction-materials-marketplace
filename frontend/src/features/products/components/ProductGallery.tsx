import {
  Cable,
  Construction,
  Droplets,
  ImageOff,
  PaintBucket,
  Warehouse,
} from "lucide-react";
import { useState } from "react";

import { resolveLocalProductImages } from "@/features/products/lib/product-images";
import type { ProductDetails } from "@/features/products/model/product";

const MAX_VISIBLE_THUMBNAILS = 6;

interface ProductGalleryProps {
  product: ProductDetails;
}

export function ProductGallery({ product }: ProductGalleryProps) {
  const imageUrls = resolveLocalProductImages(product).slice(
    0,
    MAX_VISIBLE_THUMBNAILS,
  );
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(
    imageUrls[0] ?? null,
  );
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(
    () => new Set(),
  );
  const availableImageUrls = imageUrls.filter(
    (imageUrl) => !failedImageUrls.has(imageUrl),
  );
  const activeImageUrl =
    selectedImageUrl && availableImageUrls.includes(selectedImageUrl)
      ? selectedImageUrl
      : (availableImageUrls[0] ?? null);

  function markImageAsFailed(imageUrl: string): void {
    setFailedImageUrls((current) => {
      const next = new Set(current);
      next.add(imageUrl);
      return next;
    });
  }

  return (
    <section
      aria-label={`${product.name} image gallery`}
      className="mx-auto w-full max-w-2xl lg:mx-0"
    >
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-white">
        {activeImageUrl ? (
          <img
            alt={product.name}
            className="h-full w-full object-contain p-5 sm:p-8"
            onError={() => markImageAsFailed(activeImageUrl)}
            src={activeImageUrl}
          />
        ) : (
          <ProductVisualPlaceholder category={product.category.name} />
        )}
      </div>

      {availableImageUrls.length > 1 ? (
        <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6">
          {availableImageUrls.map((imageUrl, index) => (
            <button
              aria-label={`View ${product.name} image ${index + 1}`}
              aria-pressed={imageUrl === activeImageUrl}
              className={`aspect-square overflow-hidden rounded-md border bg-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
                imageUrl === activeImageUrl
                  ? "border-emerald-700 ring-1 ring-emerald-700"
                  : "border-zinc-200 hover:border-zinc-400"
              }`}
              key={imageUrl}
              onClick={() => setSelectedImageUrl(imageUrl)}
              type="button"
            >
              <img
                alt=""
                className="h-full w-full object-contain p-2"
                loading="lazy"
                onError={() => markImageAsFailed(imageUrl)}
                src={imageUrl}
              />
            </button>
          ))}
        </div>
      ) : null}
    </section>
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
      <Icon aria-hidden="true" className="size-16" strokeWidth={1.25} />
      <span className="px-6 text-center text-sm font-semibold uppercase">
        {category}
      </span>
    </div>
  );
}
