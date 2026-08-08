import { useQueries } from "@tanstack/react-query";

import { getProductDetails } from "@/features/products/api/products.api";
import type { CustomerOrder } from "@/features/orders/model/order";

export function useOrderSellerNames(
  orders: CustomerOrder[],
): Map<string, string> {
  const productIds = [
    ...new Set(
      orders.flatMap((order) =>
        order.items.map((item) => item.productId),
      ),
    ),
  ];
  const productQueries = useQueries({
    queries: productIds.map((productId) => ({
      queryKey: ["products", "details", productId],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getProductDetails(productId, signal),
      staleTime: 5 * 60 * 1000,
    })),
  });
  const sellerNames = new Map<string, string>();

  productQueries.forEach((query) => {
    const product = query.data;
    if (product) {
      sellerNames.set(
        product.sellerId,
        product.seller.shopName || product.seller.name,
      );
    }
  });

  return sellerNames;
}
