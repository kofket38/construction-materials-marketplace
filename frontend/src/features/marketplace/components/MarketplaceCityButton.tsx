import { MapPin } from "lucide-react";

import { useMarketplaceLocationStore } from "@/features/marketplace/model/marketplace-location.store";

export function MarketplaceCityButton() {
  const selectedCity = useMarketplaceLocationStore(
    (state) => state.selectedCity,
  );
  const openSelector = useMarketplaceLocationStore(
    (state) => state.openSelector,
  );

  return (
    <button
      aria-label={
        selectedCity ? `Change city from ${selectedCity}` : "Select city"
      }
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white text-sm font-semibold text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-ring sm:h-10 sm:w-auto sm:max-w-48 sm:justify-start sm:gap-2 sm:px-3 sm:py-2"
      onClick={openSelector}
      title={selectedCity ? `Change city from ${selectedCity}` : "Select city"}
      type="button"
    >
      <MapPin aria-hidden="true" className="size-4 shrink-0 text-brand-ink" />
      <span className="hidden truncate sm:inline">
        {selectedCity ?? "Select city"}
      </span>
    </button>
  );
}
