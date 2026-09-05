/**
 * Theme preference store.
 *
 * `preference` is what the user chose; `resolved` is what is actually painted.
 * They differ only for `"system"`, where the OS setting decides. Keeping both in
 * the store means a toggle can show "System" while the icon reflects the real
 * appearance.
 *
 * The class itself is applied by `applyResolvedTheme`, which is called both from
 * here and from the pre-paint script in `index.html`, so the two can never
 * disagree about the class name or the storage key.
 */
import { create } from "zustand";

export const THEME_STORAGE_KEY = "cmm.theme";
export const DARK_CLASS_NAME = "dark";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/** Order the toggle cycles through, matching the order shown in its menu. */
export const themePreferences: readonly ThemePreference[] = [
  "light",
  "dark",
  "system",
];

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  /** Re-resolves after an OS change. A no-op unless the preference is "system". */
  syncSystemTheme: () => void;
}

export const useThemeStore = create<ThemeState>()((set, get) => ({
  preference: readStoredPreference(),
  resolved: resolveTheme(readStoredPreference()),
  setPreference: (preference) => {
    persistPreference(preference);
    const resolved = resolveTheme(preference);
    applyResolvedTheme(resolved);
    set({ preference, resolved });
  },
  syncSystemTheme: () => {
    if (get().preference !== "system") {
      return;
    }

    const resolved = resolveTheme("system");
    if (resolved === get().resolved) {
      return;
    }

    applyResolvedTheme(resolved);
    set({ resolved });
  },
}));

/** Adds or removes the single class the CSS token layer keys dark mode off. */
export function applyResolvedTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.classList.toggle(
    DARK_CLASS_NAME,
    resolved === "dark",
  );
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") {
    return preference;
  }

  return prefersDarkScheme() ? "dark" : "light";
}

export function prefersDarkScheme(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function persistPreference(preference: ThemePreference): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // The in-session choice still applies when browser storage is unavailable.
  }
}

function isThemePreference(value: unknown): value is ThemePreference {
  return (
    value === "light" ||
    value === "dark" ||
    value === "system"
  );
}
