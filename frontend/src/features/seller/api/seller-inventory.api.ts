import type {
  CreateSellerInventoryInput,
  SellerInventoryEntry,
  SellerInventoryResult,
  SellerInventoryStockFilter,
  UpdateSellerInventoryInput,
  UpdateSellerInventoryProductInput,
} from "@/features/seller/model/seller-inventory";
import type { ApiSuccessResponse } from "@/shared/api/api.types";
import { apiClient } from "@/shared/api/http-client";
import type { Product } from "@/features/products/model/product";

// ── Legacy product-management endpoints (GET /seller/products, PUT/DELETE /products/:id) ──

interface LegacyProductData {
  product: Product;
}

interface LegacyInventoryResult {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  inventorySummary: {
    totalProducts: number;
    lowStock: number;
    outOfStock: number;
    inventoryValue: string;
  };
}

export async function getSellerProducts(
  input: {
    page: number;
    limit?: number;
    search?: string;
    stock?: SellerInventoryStockFilter;
  },
  signal?: AbortSignal,
): Promise<LegacyInventoryResult> {
  const response = await apiClient.get<
    ApiSuccessResponse<LegacyInventoryResult>
  >("/seller/products", { params: input, signal });
  return response.data.data;
}

export async function updateSellerInventoryProduct(
  productId: string,
  input: UpdateSellerInventoryProductInput,
): Promise<Product> {
  const response = await apiClient.put<ApiSuccessResponse<LegacyProductData>>(
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

// ── New SellerInventory CRUD endpoints (/seller/inventory) ────────────────────

interface SellerInventoryEntryData {
  entry: SellerInventoryEntry;
}

export async function getSellerInventory(
  input: {
    page: number;
    limit?: number;
    search?: string;
    city?: string;
  },
  signal?: AbortSignal,
): Promise<SellerInventoryResult> {
  const response = await apiClient.get<
    ApiSuccessResponse<SellerInventoryResult>
  >("/seller/inventory", { params: input, signal });
  return response.data.data;
}

export async function createSellerInventory(
  input: CreateSellerInventoryInput,
): Promise<SellerInventoryEntry> {
  const response = await apiClient.post<
    ApiSuccessResponse<SellerInventoryEntryData>
  >("/seller/inventory", input);
  return response.data.data.entry;
}

export async function updateSellerInventory(
  id: string,
  input: UpdateSellerInventoryInput,
): Promise<SellerInventoryEntry> {
  const response = await apiClient.patch<
    ApiSuccessResponse<SellerInventoryEntryData>
  >(`/seller/inventory/${encodeURIComponent(id)}`, input);
  return response.data.data.entry;
}

export async function deleteSellerInventory(id: string): Promise<void> {
  await apiClient.delete<ApiSuccessResponse<null>>(
    `/seller/inventory/${encodeURIComponent(id)}`,
    { data: {} },
  );
}
