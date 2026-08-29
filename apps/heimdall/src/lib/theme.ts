import { defaultTheme as defaultThemeFromRuntime, uiStorageKey } from "@/lib/runtime-config";

export type HeimdallTheme = "dark" | "light";

export function isThemeValue(value: string | null | undefined): value is HeimdallTheme {
  return value === "dark" || value === "light";
}

export function readStoredTheme(): HeimdallTheme | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(uiStorageKey("theme"));
    return isThemeValue(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function resolveTheme(input: { stored: string | null | undefined; defaultTheme: HeimdallTheme | null | undefined }): HeimdallTheme {
  if (isThemeValue(input.stored)) return input.stored;
  if (isThemeValue(input.defaultTheme)) return input.defaultTheme;
  return "dark";
}

export function applyDocumentTheme(theme: HeimdallTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function writeStoredTheme(theme: HeimdallTheme): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(uiStorageKey("theme"), theme);
  } catch {
    // ignore quota / private mode
  }
}

export function setDocumentTheme(theme: HeimdallTheme): void {
  writeStoredTheme(theme);
  applyDocumentTheme(theme);
}

export function toggleDocumentTheme(current: HeimdallTheme): HeimdallTheme {
  const next = current === "dark" ? "light" : "dark";
  setDocumentTheme(next);
  return next;
}

/** Resolve from stored preference + config default, then apply to document root. */
export function resolveAndApplyTheme(configDefault?: HeimdallTheme | null): HeimdallTheme {
  const theme = resolveTheme({
    stored: readStoredTheme(),
    defaultTheme: configDefault ?? defaultThemeFromRuntime(),
  });
  applyDocumentTheme(theme);
  return theme;
}
