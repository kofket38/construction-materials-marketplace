import type { Product } from "@/features/products/model/product";
import type { ApiSuccessResponse } from "@/shared/api/api.types";
import { apiClient } from "@/shared/api/http-client";

export interface CreateProductInput {
  name: string;
  description: string;
  price: string;
  quantity: number;
  categoryId: string;
  imageUrl?: string | null;
}

interface ProductData {
  product: Product;
}

/**
 * POST /api/products — seller creates a new product listing.
 * sellerId is resolved from the authenticated JWT server-side.
 */
export async function createProduct(
  input: CreateProductInput,
): Promise<Product> {
  const response = await apiClient.post<ApiSuccessResponse<ProductData>>(
    "/products",
    {
      name: input.name,
      description: input.description,
      price: input.price,
      quantity: input.quantity,
      categoryId: input.categoryId,
      ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
    },
  );
  return response.data.data.product;
}
