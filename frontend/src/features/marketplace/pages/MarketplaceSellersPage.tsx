import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  LoaderCircle,
  MapPin,
  PackageSearch,
  Star,
  Store,
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";

import { useAuthStore } from "@/features/auth/model/auth.store";
import { getMarketplaceSellers } from "@/features/marketplace/api/marketplace.api";
import { useMarketplaceLocationStore } from "@/features/marketplace/model/marketplace-location.store";
import { getApiErrorMessage } from "@/shared/api/http-error";

export function MarketplaceSellersPage() {
  const user = useAuthStore((state) => state.user);
  const selectedCity = useMarketplaceLocationStore(
    (state) => state.selectedCity,
  );
  const openCitySelector = useMarketplaceLocationStore(
    (state) => state.openSelector,
  );
  const sellersQuery = useQuery({
    queryKey: ["marketplace", "sellers", selectedCity],
    enabled: Boolean(selectedCity),
    queryFn: ({ signal }) => {
      if (!selectedCity) {
        throw new Error("Select a city to browse suppliers.");
      }

      return getMarketplaceSellers(selectedCity, signal);
    },
  });

  if (user?.role === "SELLER") {
    return <Navigate replace to="/seller/dashboard" />;
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-emerald-700">
            Verified marketplace suppliers
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950">
            Suppliers {selectedCity ? `in ${selectedCity}` : "by city"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            Compare local stores, ratings, and available product ranges.
          </p>
        </div>
        <button
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          onClick={openCitySelector}
          type="button"
        >
          <MapPin aria-hidden="true" className="size-4 text-emerald-700" />
          {selectedCity ? "Change city" : "Select city"}
        </button>
      </div>

      {!selectedCity ? (
        <DirectoryStatus>
          <MapPin
            aria-hidden="true"
            className="size-9 text-emerald-700"
            strokeWidth={1.6}
          />
          <div className="text-center">
            <h2 className="font-semibold text-zinc-950">
              Select a marketplace city
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600">
              Supplier availability and inventory are organized by city.
            </p>
          </div>
          <button
            className="min-h-10 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            onClick={openCitySelector}
            type="button"
          >
            Select city
          </button>
        </DirectoryStatus>
      ) : sellersQuery.isPending ? (
        <DirectoryStatus>
          <LoaderCircle
            aria-hidden="true"
            className="size-6 animate-spin text-emerald-700"
          />
          Loading suppliers...
        </DirectoryStatus>
      ) : sellersQuery.isError ? (
        <DirectoryStatus>
          <Building2
            aria-hidden="true"
            className="size-9 text-red-700"
            strokeWidth={1.6}
          />
          <div className="text-center">
            <h2 className="font-semibold text-zinc-950">
              Unable to load suppliers
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600">
              {getApiErrorMessage(
                sellersQuery.error,
                "Suppliers could not be loaded. Please try again.",
              )}
            </p>
          </div>
          <button
            className="min-h-10 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
            onClick={() => void sellersQuery.refetch()}
            type="button"
          >
            Try again
          </button>
        </DirectoryStatus>
      ) : sellersQuery.data.length === 0 ? (
        <DirectoryStatus>
          <PackageSearch
            aria-hidden="true"
            className="size-9 text-emerald-700"
            strokeWidth={1.6}
          />
          <div className="text-center">
            <h2 className="font-semibold text-zinc-950">
              No suppliers found
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              Try another marketplace city.
            </p>
          </div>
        </DirectoryStatus>
      ) : (
        <section
          aria-label={`Suppliers in ${selectedCity}`}
          className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {sellersQuery.data.map((seller) => {
            const storeName = seller.shopName || seller.name;

            return (
              <article
                className="flex min-h-full flex-col rounded-md border border-zinc-200 bg-white p-5 shadow-sm"
                key={seller.id}
              >
                <div className="flex items-start gap-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-lg font-bold text-emerald-800">
                    {getStoreInitials(storeName)}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold text-zinc-950">
                      {storeName}
                    </h2>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-600">
                      <MapPin aria-hidden="true" className="size-4 shrink-0" />
                      {seller.city}
                    </p>
                  </div>
                </div>

                <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-zinc-200 py-4">
                  <div>
                    <dt className="text-xs font-medium text-zinc-500">
                      Products
                    </dt>
                    <dd className="mt-1 font-semibold text-zinc-950">
                      {seller.productCount.toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-zinc-500">
                      Rating
                    </dt>
                    <dd className="mt-1 flex items-center gap-1.5 font-semibold text-zinc-950">
                      <Star
                        aria-hidden="true"
                        className="size-4 fill-amber-400 text-amber-500"
                      />
                      {seller.averageRating === null
                        ? "New"
                        : `${seller.averageRating.toFixed(1)} (${seller.reviewCount})`}
                    </dd>
                  </div>
                </dl>

                <Link
                  className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
                  to={`/stores/${seller.id}`}
                >
                  <Store aria-hidden="true" className="size-4" />
                  View store
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

function DirectoryStatus({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-live="polite"
      className="flex min-h-80 flex-col items-center justify-center gap-4 py-12 text-sm font-medium text-zinc-600"
    >
      {children}
    </section>
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
