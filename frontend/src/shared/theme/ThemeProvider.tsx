/**
 * Keeps the painted theme in step with the OS while the preference is "system".
 *
 * The initial class is set by the pre-paint script in `index.html` so there is no
 * flash of the wrong theme; this provider only handles later changes. It renders
 * nothing of its own.
 */
import { useEffect } from "react";
import type { PropsWithChildren } from "react";

import { applyResolvedTheme, useThemeStore } from "@/shared/theme/theme.store";

export function ThemeProvider({ children }: PropsWithChildren) {
  const resolved = useThemeStore((state) => state.resolved);
  const syncSystemTheme = useThemeStore((state) => state.syncSystemTheme);

  // Re-assert the class after mount. The pre-paint script already ran, but a
  // stored preference that fails to parse, or a remount, should still converge.
  useEffect(() => {
    applyResolvedTheme(resolved);
  }, [resolved]);

  useEffect(() => {
    if (!window.matchMedia) {
      return;
    }

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    query.addEventListener("change", syncSystemTheme);

    // The OS may have changed between the pre-paint script and this effect.
    syncSystemTheme();

    return () => {
      query.removeEventListener("change", syncSystemTheme);
    };
  }, [syncSystemTheme]);

  return children;
}
