import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  PackageSearch,
  Search,
  X,
} from "lucide-react";
import type { FormEvent } from "react";
import { Navigate, useSearchParams } from "react-router-dom";

import { useAuthStore } from "@/features/auth/model/auth.store";
import { useMarketplaceLocationStore } from "@/features/marketplace/model/marketplace-location.store";
import { getProducts } from "@/features/products/api/products.api";
import { ProductCard } from "@/features/products/components/ProductCard";
import type {
  ProductSortBy,
  ProductSortOrder,
  ProductStockFilter,
} from "@/features/products/model/product";
import { getApiErrorMessage } from "@/shared/api/http-error";

const PAGE_SIZE = 12;

const sortOptions = [
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

type SortValue = (typeof sortOptions)[number]["value"];

export function ProductsPage() {
  const user = useAuthStore((state) => state.user);
  const selectedCity = useMarketplaceLocationStore(
    (state) => state.selectedCity,
  );
  const openCitySelector = useMarketplaceLocationStore(
    (state) => state.openSelector,
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search")?.trim() ?? "";
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const page = parsePage(searchParams.get("page"));
  const stock = parseStockFilter(searchParams.get("stock"));
  const sortValue = parseSortValue(searchParams.get("sort"));
  const selectedSort =
    sortOptions.find((option) => option.value === sortValue) ?? sortOptions[0];

  const productsQuery = useQuery({
    queryKey: [
      "products",
      "list",
      {
        page,
        search,
        city: selectedCity,
        categoryId,
        sort: selectedSort.value,
        stock,
      },
    ],
    queryFn: ({ signal }) =>
      getProducts(
        {
          city: selectedCity ?? undefined,
          categoryId,
          limit: PAGE_SIZE,
          page,
          search: search || undefined,
          sortBy: selectedSort.sortBy,
          sortOrder: selectedSort.sortOrder,
          stock,
        },
        signal,
      ),
    placeholderData: keepPreviousData,
  });

  function updateSearchParams(
    updates: Record<string, string | undefined>,
  ): void {
    const nextParams = new URLSearchParams(searchParams);

    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        nextParams.set(key, value);
      } else {
        nextParams.delete(key);
      }
    }

    setSearchParams(nextParams);
  }

  function handleSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const searchValue = new FormData(event.currentTarget)
      .get("search")
      ?.toString()
      .trim();

    updateSearchParams({
      page: undefined,
      search: searchValue || undefined,
    });
  }

  function clearFilters(): void {
    setSearchParams({});
  }

  const hasActiveFilters =
    Boolean(categoryId) ||
    Boolean(search) ||
    Boolean(stock) ||
    selectedSort.value !== "newest-desc";

  if (user?.role === "SELLER") {
    return <Navigate replace to="/seller/inventory" />;
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-700">
            {selectedCity ? `${selectedCity} marketplace` : "Marketplace catalog"}
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">
            Construction materials
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            {selectedCity
              ? `Compare materials stocked by suppliers in ${selectedCity}.`
              : "Compare available materials from marketplace suppliers."}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {productsQuery.data ? (
            <p
              aria-live="polite"
              className="text-sm font-medium text-zinc-600"
            >
              {productsQuery.data.totalItems.toLocaleString()}{" "}
              {productsQuery.data.totalItems === 1 ? "product" : "products"}
            </p>
          ) : null}
          <button
            className="min-h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            onClick={openCitySelector}
            type="button"
          >
            {selectedCity ? "Change city" : "Select city"}
          </button>
        </div>
      </div>

      <form
        className="mt-8 grid gap-3 border-y border-zinc-200 py-4 md:grid-cols-[minmax(16rem,1fr)_12rem_13rem_auto]"
        onSubmit={handleSearch}
        role="search"
      >
        <label className="relative block">
          <span className="sr-only">Search products</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
          />
          <input
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white py-2 pl-10 pr-3 text-sm text-zinc-950 outline-none transition-colors placeholder:text-zinc-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
            defaultValue={search}
            key={search}
            name="search"
            placeholder="Search materials or suppliers"
            type="search"
          />
        </label>

        <label>
          <span className="sr-only">Stock availability</span>
          <select
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
            onChange={(event) =>
              updateSearchParams({
                page: undefined,
                stock: event.target.value || undefined,
              })
            }
            value={stock ?? ""}
          >
            <option value="">All availability</option>
            <option value="in_stock">In stock</option>
            <option value="out_of_stock">Out of stock</option>
          </select>
        </label>

        <label>
          <span className="sr-only">Sort products</span>
          <select
            className="min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-800 outline-none transition-colors focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
            onChange={(event) =>
              updateSearchParams({
                page: undefined,
                sort:
                  event.target.value === "newest-desc"
                    ? undefined
                    : event.target.value,
              })
            }
            value={selectedSort.value}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex gap-2">
          <button
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 md:flex-none"
            type="submit"
          >
            <Search aria-hidden="true" className="size-4" />
            Search
          </button>
          {hasActiveFilters ? (
            <button
              aria-label="Clear catalog filters"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
              onClick={clearFilters}
              title="Clear filters"
              type="button"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          ) : null}
        </div>
      </form>

      {productsQuery.isPending ? (
        <CatalogStatus>
          <LoaderCircle
            aria-hidden="true"
            className="size-6 animate-spin text-emerald-700"
          />
          <p>Loading products...</p>
        </CatalogStatus>
      ) : productsQuery.isError ? (
        <CatalogStatus>
          <PackageSearch
            aria-hidden="true"
            className="size-8 text-red-700"
            strokeWidth={1.6}
          />
          <div className="text-center">
            <h2 className="font-semibold text-zinc-950">
              Unable to load products
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600">
              {getApiErrorMessage(
                productsQuery.error,
                "The catalog could not be loaded. Please try again.",
              )}
            </p>
          </div>
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
            onClick={() => void productsQuery.refetch()}
            type="button"
          >
            Try again
          </button>
        </CatalogStatus>
      ) : productsQuery.data.products.length === 0 ? (
        <CatalogStatus>
          <PackageSearch
            aria-hidden="true"
            className="size-9 text-emerald-700"
            strokeWidth={1.6}
          />
          <div className="text-center">
            <h2 className="font-semibold text-zinc-950">
              No products found
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              Try a different search, availability filter, or city.
            </p>
          </div>
          {hasActiveFilters ? (
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
              onClick={clearFilters}
              type="button"
            >
              Clear filters
            </button>
          ) : null}
        </CatalogStatus>
      ) : (
        <>
          <div
            aria-busy={productsQuery.isFetching}
            className={`mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${
              productsQuery.isFetching ? "opacity-60" : ""
            }`}
          >
            {productsQuery.data.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {productsQuery.data.totalPages > 1 ? (
            <nav
              aria-label="Catalog pagination"
              className="mt-8 flex items-center justify-between border-t border-zinc-200 pt-5"
            >
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!productsQuery.data.hasPreviousPage}
                onClick={() =>
                  updateSearchParams({
                    page: page > 2 ? String(page - 1) : undefined,
                  })
                }
                type="button"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                Previous
              </button>
              <p className="text-sm text-zinc-600">
                Page{" "}
                <span className="font-semibold text-zinc-950">
                  {productsQuery.data.currentPage}
                </span>{" "}
                of {productsQuery.data.totalPages}
              </p>
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!productsQuery.data.hasNextPage}
                onClick={() =>
                  updateSearchParams({ page: String(page + 1) })
                }
                type="button"
              >
                Next
                <ArrowRight aria-hidden="true" className="size-4" />
              </button>
            </nav>
          ) : null}
        </>
      )}
    </main>
  );
}

function CatalogStatus({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-live="polite"
      className="flex min-h-80 flex-col items-center justify-center gap-4 py-12 text-sm font-medium text-zinc-600"
    >
      {children}
    </section>
  );
}

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function parseStockFilter(value: string | null): ProductStockFilter | undefined {
  return value === "in_stock" || value === "out_of_stock"
    ? value
    : undefined;
}

function parseSortValue(value: string | null): SortValue {
  return sortOptions.some((option) => option.value === value)
    ? (value as SortValue)
    : "newest-desc";
}
