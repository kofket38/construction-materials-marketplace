/**
 * Product detail imagery: one large pane and a thumbnail strip.
 *
 * The images shown are the ones stored for *this* product and nothing else. The
 * catalog response already carries the primary image, so that paints immediately
 * while the full `ProductImage` record set is fetched to fill in the rest of the
 * strip; a product with no photograph renders the same placeholder here as on a
 * card, because both go through `ProductImage`.
 *
 * A URL that fails to load is dropped from the strip rather than left as a dead
 * tile, which is why the failure set lives here and not only inside
 * `ProductImage`.
 */
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { getProductImages } from "@/features/products/api/product-images.api";
import { ProductImage } from "@/features/products/components/ProductImage";
import { productImageUrls } from "@/features/products/lib/product-image";
import type { ProductDetails } from "@/features/products/model/product";

const MAX_VISIBLE_THUMBNAILS = 6;

interface ProductGalleryProps {
  product: ProductDetails;
}

export function ProductGallery({ product }: ProductGalleryProps) {
  const imagesQuery = useQuery({
    queryKey: ["products", "images", product.id],
    queryFn: ({ signal }) => getProductImages(product.id, signal),
  });

  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(
    () => new Set(),
  );

  // Failures are filtered before the cap so a broken record does not cost the
  // strip a slot it could have given to a working one.
  const imageUrls = productImageUrls(product.imageUrl, imagesQuery.data)
    .filter((imageUrl) => !failedImageUrls.has(imageUrl))
    .slice(0, MAX_VISIBLE_THUMBNAILS);

  const activeImageUrl =
    selectedImageUrl && imageUrls.includes(selectedImageUrl)
      ? selectedImageUrl
      : (imageUrls[0] ?? null);

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
        <ProductImage
          categoryName={product.category.name}
          imageUrl={activeImageUrl}
          loading="eager"
          name={product.name}
          onError={markImageAsFailed}
          size="lg"
        />
      </div>

      {imageUrls.length > 1 ? (
        <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6">
          {imageUrls.map((imageUrl, index) => (
            <button
              aria-label={`View ${product.name} image ${index + 1}`}
              aria-pressed={imageUrl === activeImageUrl}
              className={`aspect-square overflow-hidden rounded-md border bg-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring ${
                imageUrl === activeImageUrl
                  ? "border-brand ring-1 ring-brand-ring"
                  : "border-zinc-200 hover:border-zinc-400"
              }`}
              key={imageUrl}
              onClick={() => setSelectedImageUrl(imageUrl)}
              type="button"
            >
              <ProductImage
                categoryName={product.category.name}
                decorative
                imageUrl={imageUrl}
                name={product.name}
                onError={markImageAsFailed}
                size="sm"
              />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
