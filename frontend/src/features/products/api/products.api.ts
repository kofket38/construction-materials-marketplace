import { apiClient } from "@/shared/api/http-client";
import type { ApiSuccessResponse } from "@/shared/api/api.types";
import type {
  ProductDiscoveryQuery,
  ProductDiscoveryResult,
  ProductDetails,
  ProductReviewResult,
} from "@/features/products/model/product";

interface ProductDetailsData {
  product: ProductDetails;
}

export async function getProducts(
  query: ProductDiscoveryQuery = {},
  signal?: AbortSignal,
): Promise<ProductDiscoveryResult> {
  const response = await apiClient.get<
    ApiSuccessResponse<ProductDiscoveryResult>
  >("/products", {
    params: query,
    signal,
  });

  return response.data.data;
}

export async function getProductDetails(
  productId: string,
  signal?: AbortSignal,
): Promise<ProductDetails> {
  const response = await apiClient.get<
    ApiSuccessResponse<ProductDetailsData>
  >(`/products/${encodeURIComponent(productId)}`, { signal });

  return response.data.data.product;
}

export async function getProductReviews(
  productId: string,
  signal?: AbortSignal,
): Promise<ProductReviewResult> {
  const response = await apiClient.get<
    ApiSuccessResponse<ProductReviewResult>
  >(`/products/${encodeURIComponent(productId)}/reviews`, {
    signal,
  });

  return response.data.data;
}
