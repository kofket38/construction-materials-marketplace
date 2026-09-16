/**
 * The marketplace category list, shared by the landing page's category rail and
 * the catalog's category filter.
 *
 * Both surfaces read one cache entry, so the rail can never offer a category the
 * filter does not recognise. Categories change about as often as the business
 * adds a trade, hence the long `staleTime` over the client default.
 */
import { useQuery } from "@tanstack/react-query";

import { getMarketplaceCategories } from "@/features/marketplace/api/marketplace.api";

export const marketplaceCategoriesQueryKey = [
  "marketplace",
  "categories",
] as const;

export function useMarketplaceCategories() {
  return useQuery({
    queryKey: marketplaceCategoriesQueryKey,
    queryFn: ({ signal }) => getMarketplaceCategories(signal),
    staleTime: 10 * 60 * 1000,
  });
}
