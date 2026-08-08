import type {
  MarketplaceCity,
  MarketplaceSeller,
  SellerStore,
} from "@/features/marketplace/model/marketplace";
import type { ProductCategory } from "@/features/products/model/product";
import { apiClient } from "@/shared/api/http-client";
import type { ApiSuccessResponse } from "@/shared/api/api.types";

export async function getMarketplaceCities(
  signal?: AbortSignal,
): Promise<MarketplaceCity[]> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ cities: MarketplaceCity[] }>
  >("/products/marketplace/cities", { signal });

  return response.data.data.cities;
}

export async function getMarketplaceSellers(
  city: string,
  signal?: AbortSignal,
): Promise<MarketplaceSeller[]> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ sellers: MarketplaceSeller[] }>
  >("/products/marketplace/sellers", {
    params: { city },
    signal,
  });

  return response.data.data.sellers;
}

export async function getSellerStore(
  sellerId: string,
  city?: string,
  signal?: AbortSignal,
): Promise<SellerStore> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ store: SellerStore }>
  >(`/products/stores/${encodeURIComponent(sellerId)}`, {
    params: city ? { city } : undefined,
    signal,
  });

  return response.data.data.store;
}

export async function getMarketplaceCategories(
  signal?: AbortSignal,
): Promise<ProductCategory[]> {
  const response = await apiClient.get<
    ApiSuccessResponse<{ categories: ProductCategory[] }>
  >("/categories", { signal });

  return response.data.data.categories;
}
