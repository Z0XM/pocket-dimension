import { themeDark, themeLight } from "$lib/theme";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "me-via-you-theme";

export function getThemeMode(): ThemeMode {
  if (typeof document === "undefined") {
    return "dark";
  }

  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function applyThemeMode(mode: ThemeMode): void {
  document.documentElement.classList.toggle("dark", mode === "dark");

  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Ignore storage errors (private browsing, etc.)
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", mode === "dark" ? themeDark.background : themeLight.background);
  }
}

export function setThemeMode(mode: ThemeMode): ThemeMode {
  applyThemeMode(mode);
  return mode;
}

export function toggleThemeMode(): ThemeMode {
  return setThemeMode(getThemeMode() === "dark" ? "light" : "dark");
}

export function readStoredThemeMode(): ThemeMode | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}
