import type { Product } from "@/features/products/model/product";
import type { ApiSuccessResponse } from "@/shared/api/api.types";
import { apiClient } from "@/shared/api/http-client";

export interface CreateProductInput {
  name: string;
  description: string;
  price: string;
  quantity: number;
  categoryId: string;
}

interface ProductData {
  product: Product;
}

/**
 * POST /api/products — seller creates a new product listing.
 * sellerId is resolved from the authenticated JWT server-side.
 *
 * Deliberately carries no image. Photographs belong to `ProductImage` records
 * and are added afterwards through `product-images.api.ts`, which is also the
 * only place they can be replaced, removed or re-ordered. Passing one here would
 * set `Product.imageUrl` directly and give the same data two writers.
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
    },
  );
  return response.data.data.product;
}
