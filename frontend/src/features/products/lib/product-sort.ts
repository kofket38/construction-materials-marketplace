/**
 * The catalog's sort vocabulary, in one place.
 *
 * The landing page's search hands off to `/products` by building the same query
 * string the catalog parses, so both surfaces have to agree on the exact set of
 * `sort` values. Keeping the list here rather than inside the catalog page is
 * what stops the shopfront from offering a sort the catalog would silently
 * discard.
 */
import type {
  ProductSortBy,
  ProductSortOrder,
} from "@/features/products/model/product";

export const productSortOptions = [
  {
    label: "Newest",
    sortBy: "newest",
    sortOrder: "desc",
    value: "newest-desc",
  },
  {
    label: "Most popular",
    sortBy: "popularity",
    sortOrder: "desc",
    value: "popularity-desc",
  },
  {
    label: "Price: low to high",
    sortBy: "price",
    sortOrder: "asc",
    value: "price-asc",
  },
  {
    label: "Price: high to low",
    sortBy: "price",
    sortOrder: "desc",
    value: "price-desc",
  },
  {
    label: "Name: A to Z",
    sortBy: "name",
    sortOrder: "asc",
    value: "name-asc",
  },
] as const satisfies ReadonlyArray<{
  label: string;
  sortBy: ProductSortBy;
  sortOrder: ProductSortOrder;
  value: string;
}>;

export type ProductSortValue = (typeof productSortOptions)[number]["value"];

/** The order the catalog uses when no `sort` parameter is present. */
export const defaultProductSortValue: ProductSortValue = "newest-desc";

export function parseProductSortValue(value: string | null): ProductSortValue {
  return productSortOptions.some((option) => option.value === value)
    ? (value as ProductSortValue)
    : defaultProductSortValue;
}
