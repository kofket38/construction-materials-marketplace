import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, MapPin, X } from "lucide-react";
import { useEffect, useState } from "react";

import { getMarketplaceCities } from "@/features/marketplace/api/marketplace.api";
import { useMarketplaceLocationStore } from "@/features/marketplace/model/marketplace-location.store";
import { getApiErrorMessage } from "@/shared/api/http-error";

export function MarketplaceCityDialog() {
  const isOpen = useMarketplaceLocationStore(
    (state) => state.isSelectorOpen,
  );

  if (!isOpen) {
    return null;
  }

  return <MarketplaceCityDialogContent />;
}

function MarketplaceCityDialogContent() {
  const selectedCity = useMarketplaceLocationStore(
    (state) => state.selectedCity,
  );
  const closeSelector = useMarketplaceLocationStore(
    (state) => state.closeSelector,
  );
  const setSelectedCity = useMarketplaceLocationStore(
    (state) => state.setSelectedCity,
  );
  const [draftCity, setDraftCity] = useState(selectedCity ?? "");
  const citiesQuery = useQuery({
    queryKey: ["marketplace", "cities"],
    queryFn: ({ signal }) => getMarketplaceCities(signal),
    staleTime: 10 * 60 * 1000,
  });
  const availableCities = citiesQuery.data ?? [];
  const effectiveCity = availableCities.some(
    (city) => city.name === draftCity,
  )
    ? draftCity
    : selectedCity &&
        availableCities.some((city) => city.name === selectedCity)
      ? selectedCity
      : (availableCities[0]?.name ?? "");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape" && selectedCity) {
        closeSelector();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeSelector, selectedCity]);

  return (
    <div
      aria-labelledby="city-selector-heading"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/55 px-4 py-8"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && selectedCity) {
          closeSelector();
        }
      }}
      role="dialog"
    >
      <section className="w-full max-w-md rounded-md border border-zinc-200 bg-white p-5 shadow-xl sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
            <MapPin aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              className="text-xl font-semibold text-zinc-950"
              id="city-selector-heading"
            >
              Select your city
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Products and sellers will be limited to this marketplace.
            </p>
          </div>
          {selectedCity ? (
            <button
              aria-label="Close city selector"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950"
              onClick={closeSelector}
              title="Close"
              type="button"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          ) : null}
        </div>

        {citiesQuery.isPending ? (
          <div className="mt-6 flex min-h-24 items-center justify-center gap-3 text-sm text-zinc-600">
            <LoaderCircle
              aria-hidden="true"
              className="size-5 animate-spin text-emerald-700"
            />
            Loading available cities...
          </div>
        ) : citiesQuery.isError ? (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
            <p>
              {getApiErrorMessage(
                citiesQuery.error,
                "Available cities could not be loaded.",
              )}
            </p>
            <button
              className="mt-3 min-h-10 rounded-md bg-zinc-950 px-4 py-2 font-semibold text-white"
              onClick={() => void citiesQuery.refetch()}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <label className="mt-6 block">
              <span className="text-sm font-medium text-zinc-800">City</span>
              <select
                className="mt-2 min-h-12 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
                onChange={(event) => setDraftCity(event.target.value)}
                value={effectiveCity}
              >
                {availableCities.map((city) => (
                  <option key={city.name} value={city.name}>
                    {city.name} ({city.productCount} products,{" "}
                    {city.sellerCount} suppliers)
                  </option>
                ))}
              </select>
            </label>
            {availableCities.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-zinc-600">
                No city marketplaces are available yet.
              </p>
            ) : null}
            <button
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!effectiveCity}
              onClick={() => setSelectedCity(effectiveCity)}
              type="button"
            >
              <MapPin aria-hidden="true" className="size-4" />
              Browse {effectiveCity || "marketplace"}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
