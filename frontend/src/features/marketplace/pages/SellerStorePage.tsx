import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  LoaderCircle,
  Mail,
  MapPin,
  PackageSearch,
  Phone,
  Store,
} from "lucide-react";
import {
  Link,
  Navigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { useAuthStore } from "@/features/auth/model/auth.store";
import { getSellerStore } from "@/features/marketplace/api/marketplace.api";
import { useMarketplaceLocationStore } from "@/features/marketplace/model/marketplace-location.store";
import { getProducts } from "@/features/products/api/products.api";
import { ProductCard } from "@/features/products/components/ProductCard";
import { StarRating } from "@/features/products/components/StarRating";
import { formatProductDate } from "@/features/products/lib/product-display";
import { getApiErrorMessage, getHttpStatus } from "@/shared/api/http-error";

const PAGE_SIZE = 12;

export function SellerStorePage() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const selectedCity = useMarketplaceLocationStore(
    (state) => state.selectedCity,
  );
  const openCitySelector = useMarketplaceLocationStore(
    (state) => state.openSelector,
  );
  const page = parsePage(searchParams.get("page"));
  const storeQuery = useQuery({
    queryKey: ["marketplace", "store", sellerId, selectedCity],
    enabled: Boolean(sellerId),
    queryFn: ({ signal }) => {
      if (!sellerId) {
        throw new Error("A seller ID is required.");
      }

      return getSellerStore(sellerId, selectedCity ?? undefined, signal);
    },
  });
  const productsQuery = useQuery({
    queryKey: [
      "products",
      "store",
      sellerId,
      selectedCity,
      page,
    ],
    enabled: Boolean(sellerId && storeQuery.data),
    queryFn: ({ signal }) => {
      if (!sellerId) {
        throw new Error("A seller ID is required.");
      }

      return getProducts(
        {
          city: selectedCity ?? undefined,
          limit: PAGE_SIZE,
          page,
          sellerId,
          sortBy: "newest",
          sortOrder: "desc",
        },
        signal,
      );
    },
    placeholderData: keepPreviousData,
  });

  if (user?.role === "SELLER") {
    return <Navigate replace to="/seller/dashboard" />;
  }

  if (!sellerId) {
    return <StoreNotFound />;
  }

  if (storeQuery.isPending) {
    return <StorePageStatus loading />;
  }

  if (storeQuery.isError) {
    if (getHttpStatus(storeQuery.error) === 404) {
      return <StoreNotFound />;
    }

    return (
      <StorePageStatus
        description={getApiErrorMessage(
          storeQuery.error,
          "The store could not be loaded. Please try again.",
        )}
        onRetry={() => void storeQuery.refetch()}
      />
    );
  }

  const store = storeQuery.data;

  return (
    <main>
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-ink hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring"
            to="/stores"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            All suppliers
          </Link>

          <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-start gap-5">
              <span className="flex size-16 shrink-0 items-center justify-center rounded-md bg-brand text-xl font-bold text-on-brand">
                {getStoreInitials(store.storeName)}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-brand-ink">
                  Marketplace supplier
                </p>
                <h1 className="mt-1 text-3xl font-semibold text-zinc-950">
                  {store.storeName}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-600">
                  {store.city ? (
                    <span className="inline-flex items-center gap-2">
                      <MapPin aria-hidden="true" className="size-4" />
                      {store.city}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays aria-hidden="true" className="size-4" />
                    Joined {formatProductDate(store.joinedAt)}
                  </span>
                  {store.averageRating !== null ? (
                    <span className="inline-flex items-center gap-2">
                      <StarRating rating={store.averageRating} />
                      {store.averageRating.toFixed(1)} (
                      {store.reviewCount.toLocaleString()})
                    </span>
                  ) : (
                    <span>New supplier</span>
                  )}
                </div>
              </div>
            </div>

            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring"
              onClick={openCitySelector}
              type="button"
            >
              <MapPin aria-hidden="true" className="size-4 text-brand-ink" />
              {selectedCity ? "Change city" : "Select city"}
            </button>
          </div>

          <dl className="mt-8 grid gap-px overflow-hidden rounded-md border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-4">
            <StoreFact
              label="Available products"
              value={store.totalProducts.toLocaleString()}
            />
            <StoreFact
              icon="phone"
              label="Contact"
              value={store.phone ?? "Not provided"}
            />
            <StoreFact icon="email" label="Email" value={store.email} />
            <StoreFact
              icon="location"
              label="Address"
              value={store.address ?? "Not provided"}
            />
          </dl>
        </div>
      </section>

      <section
        aria-labelledby="store-products-heading"
        className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-brand-ink">
              Store inventory
            </p>
            <h2
              className="mt-1 text-2xl font-semibold text-zinc-950"
              id="store-products-heading"
            >
              Products {selectedCity ? `in ${selectedCity}` : ""}
            </h2>
          </div>
          {productsQuery.data ? (
            <p className="text-sm font-medium text-zinc-600">
              {productsQuery.data.totalItems.toLocaleString()}{" "}
              {productsQuery.data.totalItems === 1 ? "product" : "products"}
            </p>
          ) : null}
        </div>

        {productsQuery.isPending ? (
          <ProductStatus>
            <LoaderCircle
              aria-hidden="true"
              className="size-6 animate-spin text-brand-ink"
            />
            Loading store inventory...
          </ProductStatus>
        ) : productsQuery.isError ? (
          <ProductStatus>
            <AlertTriangle
              aria-hidden="true"
              className="size-8 text-red-700"
              strokeWidth={1.6}
            />
            <p>
              {getApiErrorMessage(
                productsQuery.error,
                "Store inventory could not be loaded.",
              )}
            </p>
            <button
              className="min-h-10 rounded-md bg-zinc-950 px-4 py-2 font-semibold text-white"
              onClick={() => void productsQuery.refetch()}
              type="button"
            >
              Try again
            </button>
          </ProductStatus>
        ) : productsQuery.data.products.length === 0 ? (
          <ProductStatus>
            <PackageSearch
              aria-hidden="true"
              className="size-9 text-brand-ink"
              strokeWidth={1.6}
            />
            <div className="text-center">
              <h3 className="font-semibold text-zinc-950">
                No products in this city
              </h3>
              <p className="mt-2 text-sm text-zinc-600">
                Change city to view the supplier&apos;s other inventory.
              </p>
            </div>
          </ProductStatus>
        ) : (
          <>
            <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {productsQuery.data.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {productsQuery.data.totalPages > 1 ? (
              <nav
                aria-label="Store inventory pagination"
                className="mt-8 flex items-center justify-between border-t border-zinc-200 pt-5"
              >
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!productsQuery.data.hasPreviousPage}
                  onClick={() => {
                    const nextParams = new URLSearchParams(searchParams);
                    if (page <= 2) {
                      nextParams.delete("page");
                    } else {
                      nextParams.set("page", String(page - 1));
                    }
                    setSearchParams(nextParams);
                  }}
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
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!productsQuery.data.hasNextPage}
                  onClick={() => {
                    const nextParams = new URLSearchParams(searchParams);
                    nextParams.set("page", String(page + 1));
                    setSearchParams(nextParams);
                  }}
                  type="button"
                >
                  Next
                  <ArrowRight aria-hidden="true" className="size-4" />
                </button>
              </nav>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}

function StoreFact({
  icon,
  label,
  value,
}: {
  icon?: "email" | "location" | "phone";
  label: string;
  value: string;
}) {
  const Icon =
    icon === "email" ? Mail : icon === "location" ? MapPin : Phone;

  return (
    <div className="min-w-0 bg-white p-4">
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      <dd className="mt-2 flex min-w-0 items-center gap-2 font-semibold text-zinc-950">
        {icon ? (
          <Icon aria-hidden="true" className="size-4 shrink-0 text-brand-ink" />
        ) : (
          <Store aria-hidden="true" className="size-4 shrink-0 text-brand-ink" />
        )}
        <span className="truncate" title={value}>
          {value}
        </span>
      </dd>
    </div>
  );
}

function StorePageStatus({
  description,
  loading = false,
  onRetry,
}: {
  description?: string;
  loading?: boolean;
  onRetry?: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <section className="max-w-md text-center" aria-live="polite">
        {loading ? (
          <LoaderCircle
            aria-hidden="true"
            className="mx-auto size-8 animate-spin text-brand-ink"
          />
        ) : (
          <AlertTriangle
            aria-hidden="true"
            className="mx-auto size-9 text-red-700"
            strokeWidth={1.6}
          />
        )}
        <h1 className="mt-5 text-2xl font-semibold text-zinc-950">
          {loading ? "Loading store" : "Unable to load store"}
        </h1>
        {description ? (
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            {description}
          </p>
        ) : null}
        {onRetry ? (
          <button
            className="mt-6 min-h-10 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            onClick={onRetry}
            type="button"
          >
            Try again
          </button>
        ) : null}
      </section>
    </main>
  );
}

function StoreNotFound() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
      <section>
        <Store
          aria-hidden="true"
          className="size-9 text-brand-ink"
          strokeWidth={1.6}
        />
        <p className="mt-5 text-sm font-semibold text-brand-ink">404</p>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-950">
          Store not found
        </h1>
        <p className="mt-3 max-w-md text-base leading-7 text-zinc-600">
          This supplier may be unavailable in the selected city.
        </p>
        <Link
          className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          to="/stores"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Browse suppliers
        </Link>
      </section>
    </main>
  );
}

function ProductStatus({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-4 py-12 text-sm font-medium text-zinc-600">
      {children}
    </div>
  );
}

function getStoreInitials(storeName: string): string {
  return storeName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}
