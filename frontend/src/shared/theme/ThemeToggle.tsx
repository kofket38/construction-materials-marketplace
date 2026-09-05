/**
 * Three-way theme control: Light / Dark / System.
 *
 * A segmented radio group rather than a cycling button, so the current choice —
 * including "System" — is always visible instead of having to be inferred from
 * an icon. Arrow keys move between options because only the checked radio is in
 * the tab order, which is the expected behaviour for a radio group.
 */
import { Monitor, Moon, Sun } from "lucide-react";
import type { ComponentType } from "react";

import {
  themePreferences,
  useThemeStore,
  type ThemePreference,
} from "@/shared/theme/theme.store";

const optionIcons: Record<
  ThemePreference,
  ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>
> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const optionLabels: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

interface ThemeToggleProps {
  /** Renders full-width with text labels, for the mobile menu and footer. */
  layout?: "compact" | "labelled";
  className?: string;
}

export function ThemeToggle({
  layout = "compact",
  className,
}: ThemeToggleProps) {
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const offset =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;

    if (offset === 0) {
      return;
    }

    event.preventDefault();
    const currentIndex = themePreferences.indexOf(preference);
    const nextIndex =
      (currentIndex + offset + themePreferences.length) %
      themePreferences.length;
    setPreference(themePreferences[nextIndex]);
  };

  return (
    <div
      aria-label="Colour theme"
      className={[
        "inline-flex items-center gap-0.5 rounded-lg border border-line bg-sunken p-0.5",
        layout === "labelled" ? "w-full" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      onKeyDown={handleKeyDown}
      role="radiogroup"
    >
      {themePreferences.map((option) => {
        const Icon = optionIcons[option];
        const isSelected = option === preference;

        return (
          <button
            aria-checked={isSelected}
            className={[
              "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors",
              layout === "labelled" ? "flex-1 min-h-10" : "",
              isSelected
                ? "bg-brand text-on-brand"
                : "text-ink-3 hover:bg-raised hover:text-ink",
            ]
              .filter(Boolean)
              .join(" ")}
            key={option}
            onClick={() => setPreference(option)}
            role="radio"
            tabIndex={isSelected ? 0 : -1}
            title={`${optionLabels[option]} theme`}
            type="button"
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span className={layout === "labelled" ? "" : "sr-only"}>
              {optionLabels[option]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
