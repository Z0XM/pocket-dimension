export const APPEARANCE_STORAGE_KEY = "chhan-appearance";
/** Bump when defaults change so old stored prefs can migrate. */
export const APPEARANCE_VERSION = 2;

export const FONT_IDS = ["virgil", "architects", "gaegu", "indie", "kalam", "virgil-kalam", "architects-gaegu", "indie-kalam"] as const;

export const PAPER_IDS = ["plain", "rough", "lines", "lines-gray", "grid", "grid-gray", "dots", "dots-gray"] as const;

export const THEME_IDS = ["light", "dark", "system"] as const;

export type FontId = (typeof FONT_IDS)[number];
export type PaperId = (typeof PAPER_IDS)[number];
export type ThemeId = (typeof THEME_IDS)[number];
export type ResolvedTheme = "light" | "dark";

export type Appearance = {
  fonts: FontId;
  paper: PaperId;
  theme: ThemeId;
};

type StoredAppearance = Partial<Appearance> & { v?: number };

export const DEFAULT_APPEARANCE: Appearance = {
  fonts: "gaegu",
  paper: "dots",
  theme: "light",
};

export const FONT_OPTIONS: ReadonlyArray<{ id: FontId; label: string }> = [
  { id: "virgil", label: "Virgil" },
  { id: "architects", label: "Architects Daughter" },
  { id: "gaegu", label: "Gaegu" },
  { id: "indie", label: "Indie Flower" },
  { id: "kalam", label: "Kalam" },
  { id: "virgil-kalam", label: "Virgil + Kalam" },
  { id: "architects-gaegu", label: "Architects + Gaegu" },
  { id: "indie-kalam", label: "Indie Flower + Kalam" },
];

export const PAPER_OPTIONS: ReadonlyArray<{ id: PaperId; label: string }> = [
  { id: "plain", label: "plain" },
  { id: "rough", label: "rough" },
  { id: "lines", label: "blue lines" },
  { id: "lines-gray", label: "gray lines" },
  { id: "grid", label: "blue grid" },
  { id: "grid-gray", label: "gray grid" },
  { id: "dots", label: "blue dots" },
  { id: "dots-gray", label: "gray dots" },
];

export const THEME_OPTIONS: ReadonlyArray<{ id: ThemeId; label: string }> = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

const THEME_COLOR_LIGHT = "#fffefd";
const THEME_COLOR_DARK = "#121212";

let systemThemeListener: ((event: MediaQueryListEvent) => void) | null = null;
let systemThemeMql: MediaQueryList | null = null;

function isFontId(value: unknown): value is FontId {
  return typeof value === "string" && (FONT_IDS as readonly string[]).includes(value);
}

function isPaperId(value: unknown): value is PaperId {
  return typeof value === "string" && (PAPER_IDS as readonly string[]).includes(value);
}

function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

export function prefersDarkScheme(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(theme: ThemeId, prefersDark: boolean = prefersDarkScheme()): ResolvedTheme {
  if (theme === "light" || theme === "dark") return theme;
  return prefersDark ? "dark" : "light";
}

export function normalizeAppearance(input: Partial<Appearance> | null | undefined): Appearance {
  return {
    fonts: isFontId(input?.fonts) ? input.fonts : DEFAULT_APPEARANCE.fonts,
    paper: isPaperId(input?.paper) ? input.paper : DEFAULT_APPEARANCE.paper,
    theme: isThemeId(input?.theme) ? input.theme : DEFAULT_APPEARANCE.theme,
  };
}

export function readAppearance(): Appearance {
  if (typeof localStorage === "undefined") return { ...DEFAULT_APPEARANCE };
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APPEARANCE };
    const parsed = JSON.parse(raw) as StoredAppearance;
    const version = typeof parsed.v === "number" ? parsed.v : 1;
    // v1 defaulted theme to "system" (followed OS). v2 defaults to light.
    if (version < APPEARANCE_VERSION && (!parsed.theme || parsed.theme === "system")) {
      const migrated = normalizeAppearance({ ...parsed, theme: "light" });
      writeAppearance(migrated);
      return migrated;
    }
    return normalizeAppearance(parsed);
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function writeAppearance(appearance: Appearance): void {
  if (typeof localStorage === "undefined") return;
  const next = normalizeAppearance(appearance);
  const payload: StoredAppearance = { ...next, v: APPEARANCE_VERSION };
  localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(payload));
}

function syncThemeColorMeta(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const content = resolved === "dark" ? THEME_COLOR_DARK : THEME_COLOR_LIGHT;
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    if (!meta.hasAttribute("media")) {
      meta.setAttribute("content", content);
    }
  }
}

function clearSystemThemeListener(): void {
  if (systemThemeMql && systemThemeListener) {
    systemThemeMql.removeEventListener("change", systemThemeListener);
  }
  systemThemeMql = null;
  systemThemeListener = null;
}

function ensureSystemThemeListener(): void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
  if (systemThemeListener) return;

  systemThemeMql = window.matchMedia("(prefers-color-scheme: dark)");
  systemThemeListener = () => {
    const appearance = readAppearance();
    if (appearance.theme !== "system") return;
    applyResolvedTheme(resolveTheme("system", systemThemeMql?.matches ?? false));
  };
  systemThemeMql.addEventListener("change", systemThemeListener);
}

function applyResolvedTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.style.colorScheme = resolved;
  syncThemeColorMeta(resolved);
}

export function applyAppearanceToDocument(appearance: Appearance = readAppearance()): Appearance {
  const next = normalizeAppearance(appearance);
  if (typeof document === "undefined") return next;

  document.documentElement.setAttribute("data-fonts", next.fonts);
  document.documentElement.setAttribute("data-paper", next.paper);

  const resolved = resolveTheme(next.theme);
  applyResolvedTheme(resolved);

  if (next.theme === "system") {
    ensureSystemThemeListener();
  } else {
    clearSystemThemeListener();
  }

  return next;
}

export function setAppearance(partial: Partial<Appearance>): Appearance {
  const next = normalizeAppearance({ ...readAppearance(), ...partial });
  writeAppearance(next);
  return applyAppearanceToDocument(next);
}

export function getResolvedTheme(appearance: Appearance = readAppearance()): ResolvedTheme {
  return resolveTheme(appearance.theme);
}
