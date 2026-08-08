import type { Product } from "@/features/products/model/product";
import type {
  SellerInventoryResult,
  SellerInventoryStockFilter,
  UpdateSellerInventoryProductInput,
} from "@/features/seller/model/seller-inventory";
import type { ApiSuccessResponse } from "@/shared/api/api.types";
import { apiClient } from "@/shared/api/http-client";

interface ProductData {
  product: Product;
}

export async function getSellerInventory(
  input: {
    page: number;
    limit?: number;
    search?: string;
    stock?: SellerInventoryStockFilter;
  },
  signal?: AbortSignal,
): Promise<SellerInventoryResult> {
  const response = await apiClient.get<
    ApiSuccessResponse<SellerInventoryResult>
  >("/seller/products", {
    params: input,
    signal,
  });

  return response.data.data;
}

export async function updateSellerInventoryProduct(
  productId: string,
  input: UpdateSellerInventoryProductInput,
): Promise<Product> {
  const response = await apiClient.put<ApiSuccessResponse<ProductData>>(
    `/products/${encodeURIComponent(productId)}`,
    input,
  );

  return response.data.data.product;
}

export async function deleteSellerInventoryProduct(
  productId: string,
): Promise<void> {
  await apiClient.delete<ApiSuccessResponse<null>>(
    `/products/${encodeURIComponent(productId)}`,
    { data: {} },
  );
}
