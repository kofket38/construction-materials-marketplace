import type { ProductDetails } from "@/features/products/model/product";
import { getProductDetails } from "@/features/products/api/products.api";
import { getHttpStatus } from "@/shared/api/http-error";

export interface RefreshedCartProducts {
  products: ProductDetails[];
  unavailableProductIds: string[];
}

export async function refreshCartProducts(
  productIds: string[],
  signal?: AbortSignal,
): Promise<RefreshedCartProducts> {
  const results = await Promise.all(
    productIds.map(async (productId) => {
      try {
        return {
          product: await getProductDetails(productId, signal),
          productId,
        };
      } catch (error) {
        if (getHttpStatus(error) === 404) {
          return { product: null, productId };
        }

        throw error;
      }
    }),
  );

  return {
    products: results.flatMap((result) =>
      result.product ? [result.product] : [],
    ),
    unavailableProductIds: results.flatMap((result) =>
      result.product ? [] : [result.productId],
    ),
  };
}
