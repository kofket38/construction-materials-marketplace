/**
 * The seller's post-creation control over a product's photography.
 *
 * CMM ships no product imagery of its own, so this dialog is the only way a
 * listing ever gets a picture. It is a thin client over the four endpoints that
 * already exist and already enforce the rules — add, list, delete, set primary —
 * and it adds no authorization logic of its own beyond not rendering for someone
 * who is not a seller. A seller who opens this on a product another seller
 * created gets the API's 403 message in the error strip rather than a guess made
 * here about who owns what.
 *
 * `ProductImage` rows are the source of truth. Nothing in here writes
 * `Product.imageUrl`; the backend projects the primary row into that field on
 * read, which is why setting a new primary is enough to change what every card,
 * cart line and order row shows.
 */
import { ImageOff, LoaderCircle, Star, Trash2, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import {
  MAX_PRODUCT_IMAGES,
  addProductImage,
  deleteProductImage,
  getProductImages,
  setPrimaryProductImage,
} from "@/features/products/api/product-images.api";
import { getApiErrorMessage } from "@/shared/api/http-error";

interface ProductImagesDialogProps {
  productId: string;
  productName: string;
  onClose: () => void;
}

export function ProductImagesDialog({
  productId,
  productName,
  onClose,
}: ProductImagesDialogProps) {
  const queryClient = useQueryClient();

  const [imageUrl, setImageUrl] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const imagesQuery = useQuery({
    queryKey: ["products", "images", productId],
    queryFn: ({ signal }) => getProductImages(productId, signal),
  });

  /**
   * A change to this product's images changes what the marketplace, the cart and
   * the seller's own inventory table show, because every one of those surfaces
   * reads the primary image through the product projection. Refetching only the
   * dialog's own list would leave the thumbnail behind it stale.
   */
  function invalidate(): void {
    void queryClient.invalidateQueries({
      queryKey: ["products", "images", productId],
    });
    void queryClient.invalidateQueries({ queryKey: ["products"] });
    void queryClient.invalidateQueries({ queryKey: ["seller", "inventory"] });
  }

  const addMutation = useMutation({
    mutationFn: (url: string) => addProductImage(productId, url),
    onSuccess: () => {
      setImageUrl("");
      setValidationError(null);
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (imageId: string) => deleteProductImage(productId, imageId),
    onSuccess: invalidate,
  });

  const primaryMutation = useMutation({
    mutationFn: (imageId: string) => setPrimaryProductImage(productId, imageId),
    onSuccess: invalidate,
  });

  const images = imagesQuery.data ?? [];
  const isBusy =
    addMutation.isPending ||
    deleteMutation.isPending ||
    primaryMutation.isPending;
  const atLimit = images.length >= MAX_PRODUCT_IMAGES;

  /**
   * Mirrors the server's rule (`managedProductImageUrlSchema`) so a typo is
   * caught without a round trip. The server still validates; this is only here
   * to answer faster.
   */
  function validate(): boolean {
    const trimmed = imageUrl.trim();

    if (!trimmed) {
      setValidationError("Enter an image URL.");
      return false;
    }
    if (trimmed.length > 2048) {
      setValidationError("Image URL must be 2048 characters or fewer.");
      return false;
    }

    let protocol: string;
    try {
      protocol = new URL(trimmed).protocol;
    } catch {
      setValidationError("Enter a valid URL, including https://.");
      return false;
    }
    if (protocol !== "http:" && protocol !== "https:") {
      setValidationError("Image URL must use HTTP or HTTPS.");
      return false;
    }

    setValidationError(null);
    return true;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (isBusy || atLimit || !validate()) {
      return;
    }

    addMutation.mutate(imageUrl.trim());
  }

  const mutationError = addMutation.isError
    ? getApiErrorMessage(addMutation.error, "The image could not be added.")
    : deleteMutation.isError
      ? getApiErrorMessage(
          deleteMutation.error,
          "The image could not be removed.",
        )
      : primaryMutation.isError
        ? getApiErrorMessage(
            primaryMutation.error,
            "The primary image could not be changed.",
          )
        : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/45 px-4 py-8"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !isBusy) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="product-images-title"
        aria-modal="true"
        className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-md border border-zinc-200 bg-white shadow-xl"
        role="dialog"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 p-6">
          <div>
            <p className="text-sm font-semibold text-brand-ink">
              Product images
            </p>
            <h2
              className="mt-1 text-xl font-semibold text-zinc-950"
              id="product-images-title"
            >
              {productName}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Images you add here are what buyers see. Up to{" "}
              {MAX_PRODUCT_IMAGES}; the primary one represents the product in
              listings.
            </p>
          </div>
          <button
            aria-label="Close"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 disabled:opacity-50"
            disabled={isBusy}
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Server-side failure from any of the three mutations */}
          {mutationError ? (
            <p
              className="mb-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              role="alert"
            >
              {mutationError}
            </p>
          ) : null}

          {/* Current images */}
          {imagesQuery.isPending ? (
            <p className="flex items-center gap-2 text-sm text-zinc-500">
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              Loading images…
            </p>
          ) : imagesQuery.isError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
              <p>
                {getApiErrorMessage(
                  imagesQuery.error,
                  "Images could not be loaded.",
                )}
              </p>
              <button
                className="mt-2 font-semibold underline"
                onClick={() => void imagesQuery.refetch()}
                type="button"
              >
                Try again
              </button>
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-zinc-300 bg-raised px-6 py-10 text-center text-ink-faint">
              <ImageOff aria-hidden="true" className="size-10" strokeWidth={1.35} />
              <p className="text-sm font-medium">Image not available</p>
              <p className="max-w-xs text-xs">
                This product has no images yet. Add one below and it becomes the
                primary image automatically.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {images.map((image) => (
                <li
                  className="flex items-center gap-3 rounded-md border border-zinc-200 p-3"
                  key={image.id}
                >
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-raised">
                    {/* Deliberately a plain <img>: this is the seller checking
                        the URL they pasted actually resolves, so a broken one
                        should look broken here rather than be smoothed over. */}
                    <img
                      alt=""
                      className="size-full object-cover"
                      loading="lazy"
                      src={image.imageUrl}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-700">
                      {image.imageUrl}
                    </p>
                    {image.isPrimary ? (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-brand-line bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-ink">
                        <Star aria-hidden="true" className="size-3" />
                        Primary
                      </span>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {image.isPrimary ? null : (
                      <button
                        aria-label={`Make this the primary image for ${productName}`}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                        disabled={isBusy}
                        onClick={() => primaryMutation.mutate(image.id)}
                        type="button"
                      >
                        <Star aria-hidden="true" className="size-3.5" />
                        Primary
                      </button>
                    )}
                    <button
                      aria-label={`Remove this image from ${productName}`}
                      className="inline-flex size-9 items-center justify-center rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50"
                      disabled={isBusy}
                      onClick={() => deleteMutation.mutate(image.id)}
                      title="Remove image"
                      type="button"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Add an image */}
          <form className="mt-6" onSubmit={handleSubmit} noValidate>
            <label
              className="block text-sm font-medium text-zinc-800"
              htmlFor="product-image-url"
            >
              Add image URL
            </label>
            <div className="mt-2 flex gap-2">
              <input
                className="min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-ring/15 disabled:opacity-60"
                disabled={isBusy || atLimit}
                id="product-image-url"
                maxLength={2048}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="https://example.com/product-photo.jpg"
                value={imageUrl}
              />
              <button
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-on-brand hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isBusy || atLimit}
                type="submit"
              >
                {addMutation.isPending ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                ) : null}
                Add
              </button>
            </div>

            {validationError ? (
              <p className="mt-1 text-xs text-red-700" role="alert">
                {validationError}
              </p>
            ) : null}

            {atLimit ? (
              <p className="mt-2 text-xs text-amber-800">
                This product has the maximum of {MAX_PRODUCT_IMAGES} images.
                Remove one before adding another.
              </p>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">
                Paste a public HTTPS link to your own photograph of this product.
              </p>
            )}
          </form>
        </div>

        <div className="flex justify-end border-t border-zinc-200 p-4">
          <button
            className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
            disabled={isBusy}
            onClick={onClose}
            type="button"
          >
            Done
          </button>
        </div>
      </section>
    </div>
  );
}
