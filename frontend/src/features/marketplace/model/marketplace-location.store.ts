import { create } from "zustand";

const CITY_STORAGE_KEY = "cmm.marketplace.city";

interface MarketplaceLocationState {
  isSelectorOpen: boolean;
  selectedCity: string | null;
  closeSelector: () => void;
  openSelector: () => void;
  setSelectedCity: (city: string) => void;
}

export const useMarketplaceLocationStore =
  create<MarketplaceLocationState>()((set) => ({
    isSelectorOpen: false,
    selectedCity: readSelectedCity(),
    closeSelector: () => set({ isSelectorOpen: false }),
    openSelector: () => set({ isSelectorOpen: true }),
    setSelectedCity: (city) => {
      const normalizedCity = city.trim();
      if (!normalizedCity) {
        return;
      }

      persistSelectedCity(normalizedCity);
      set({
        isSelectorOpen: false,
        selectedCity: normalizedCity,
      });
    },
  }));

function readSelectedCity(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage.getItem(CITY_STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistSelectedCity(city: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(CITY_STORAGE_KEY, city);
  } catch {
    // The in-memory selection still works when browser storage is unavailable.
  }
}
