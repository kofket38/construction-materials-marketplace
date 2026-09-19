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
