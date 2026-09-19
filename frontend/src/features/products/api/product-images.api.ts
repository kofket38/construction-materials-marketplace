import { apiClient } from "@/shared/api/http-client";
import type { ApiSuccessResponse } from "@/shared/api/api.types";
import type { ProductImageRecord } from "@/features/products/model/product";

interface ProductImagesData {
  images: ProductImageRecord[];
}

/**
 * Reads the product's real `ProductImage` records.
 *
 * The endpoint is public and already returns them primary-first, so the caller
 * can render the array in order without re-sorting. An empty array is a valid,
 * expected answer: it means the product has no photograph yet, and the UI shows
 * a neutral placeholder rather than substituting another product's image.
 */
export async function getProductImages(
  productId: string,
  signal?: AbortSignal,
): Promise<ProductImageRecord[]> {
  const response = await apiClient.get<ApiSuccessResponse<ProductImagesData>>(
    `/products/${encodeURIComponent(productId)}/images`,
    { signal },
  );

  return response.data.data.images;
}

/**
 * The most images the API will store for one product. Mirrors
 * `MAX_PRODUCT_IMAGES` in `backend/src/repositories/product.repository.ts`.
 *
 * The server is the authority — exceeding it answers 409 and the UI surfaces
 * that message. This constant only lets the seller UI disable the add control
 * before the round trip, which is a convenience, not a second rule.
 */
export const MAX_PRODUCT_IMAGES = 8;

/**
 * POST /api/products/:id/images — the seller adds an image to a product.
 *
 * Seller-only and ownership-checked server-side: managing images for a product
 * another seller created answers 403, and that message is what the caller shows.
 * The first image on a product becomes its primary automatically.
 */
export async function addProductImage(
  productId: string,
  imageUrl: string,
): Promise<ProductImageRecord> {
  const response = await apiClient.post<
    ApiSuccessResponse<{ image: ProductImageRecord }>
  >(`/products/${encodeURIComponent(productId)}/images`, { imageUrl });

  return response.data.data.image;
}

/**
 * DELETE /api/products/:id/images/:imageId — the seller removes one image.
 *
 * Removing the primary promotes the next remaining image server-side, so the
 * caller only has to refetch.
 */
export async function deleteProductImage(
  productId: string,
  imageId: string,
): Promise<void> {
  await apiClient.delete(
    `/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`,
  );
}

/**
 * PATCH /api/products/:id/images/:imageId/primary — the seller chooses which
 * image represents the product in listings, cards and carts.
 */
export async function setPrimaryProductImage(
  productId: string,
  imageId: string,
): Promise<ProductImageRecord> {
  const response = await apiClient.patch<
    ApiSuccessResponse<{ image: ProductImageRecord }>
  >(
    `/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}/primary`,
    {},
  );

  return response.data.data.image;
}
