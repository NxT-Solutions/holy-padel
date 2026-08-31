import { getSetting, type SqlDriver, setSetting } from "@holy-padel/db";
import { requireOptionalNativeModule } from "expo";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { useCallback, useEffect, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { useColorScheme } from "react-native";
import { useDbMutation, useDbQuery } from "@/db/provider.tsx";
import {
  applyTheme,
  notifyThemeChanged,
  subscribeTheme,
  type ThemeMode,
  themeMode,
} from "@/theme/colors.ts";

export type ThemeSetting = "system" | "light" | "dark";

function resolveTheme(setting: ThemeSetting | undefined, systemDark: boolean): ThemeMode {
  if (setting === "light" || setting === "dark") {
    return setting;
  }
  return systemDark ? "dark" : "light";
}

const SETTING_KEY = "theme";

/** Read the persisted theme setting (undefined = follow the system). */
export function loadThemeSetting(driver: SqlDriver): ThemeSetting | undefined {
  const value = getSetting(driver, SETTING_KEY);
  return value === "light" || value === "dark" || value === "system" ? value : undefined;
}

/**
 * The SYSTEM theme, read the reliable way. RN's `useColorScheme()` mirrors the
 * application context, whose configuration Android can leave pinned to light —
 * the `SystemTheme` native module reads the CURRENT activity configuration
 * instead (MainActivity pins it to follow the system). On web (e2e) there is
 * no native module, so the emulated `useColorScheme()` stands.
 */
function useSystemTheme(): ThemeMode {
  const seeded = useColorScheme();
  const [system, setSystem] = useState<ThemeMode>(seeded === "dark" ? "dark" : "light");
  useEffect(() => {
    try {
      const dark = requireOptionalNativeModule("SystemTheme")?.isDarkMode() === true;
      setSystem(dark ? "dark" : "light");
    } catch {
      // No native module (web, Expo Go) — keep the seeded scheme.
    }
  }, []);
  return system;
}

/** Re-render on theme flips — for consumers ABOVE the db-reactive tree. */
export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribeTheme, themeMode);
}

export function ThemeController(): ReactNode {
  const mode = useTheme();
  // Notify subscribers after commit (before paint) so root-level consumers —
  // the navigator background in _layout — re-render with the new palette.
  useLayoutEffect(() => {
    notifyThemeChanged();
  }, [mode]);
  // Rendered here — above the screens but inside the db-reactive tree — so
  // the OS chrome flips in the same render as the palette.
  return <StatusBar style={mode === "dark" ? "light" : "dark"} />;
}

/** Resolve the setting + system scheme into the active palette. Idempotent. */
export function useTheme(): ThemeMode {
  const setting = useDbQuery(loadThemeSetting);
  const system = useSystemTheme();
  const resolved = resolveTheme(setting, system === "dark");

  // Apply during render so children never paint with a stale palette; the
  // state flips above this component re-render the tree afterwards.
  if (themeMode() !== resolved) {
    applyTheme(resolved);
  }

  return resolved;
}

/** Persist a theme choice; `system` removes the override. */
export function useSetThemeSetting(): (value: ThemeSetting) => void {
  const mutate = useDbMutation();
  return useCallback(
    (value: ThemeSetting) => {
      mutate((driver) => {
        setSetting(driver, SETTING_KEY, value);
      });
    },
    [mutate],
  );
}

/** True while the currently-applied palette is dark (status bar icons etc.). */
export function useIsDarkTheme(): boolean {
  return useTheme() === "dark";
}
