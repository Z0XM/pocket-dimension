/** User theme prefs — accent, page background, card/window surface, animations. */

export const ZAP_THEME_STORAGE_KEY = "zap.theme.prefs";

/** Accents tuned near #ff6b4a luminance (~0.32) and punch. */
export const ACCENT_PRESETS = [
  { id: "coral", label: "Coral", value: "#ff6b4a", foreground: "#1a0d08" },
  { id: "red", label: "Red", value: "#ff4d4d", foreground: "#1a0808" },
  { id: "purple", label: "Purple", value: "#c45cff", foreground: "#14081a" },
  { id: "pink", label: "Pink", value: "#ff5a9e", foreground: "#1a0810" },
  { id: "white", label: "White", value: "#f0ebe3", foreground: "#12100e" },
  { id: "yellow", label: "Yellow", value: "#ffc24a", foreground: "#1a1408" },
  { id: "green", label: "Green", value: "#4adf7a", foreground: "#08140e" },
  { id: "blue", label: "Blue", value: "#4a9eff", foreground: "#081018" },
] as const;

/** Page grounds — near-black with optional cool tints. */
export const PAGE_PRESETS = [
  { id: "dark-black", label: "Dark black", value: "#050505" },
  { id: "black", label: "Black", value: "#0a0a0a" },
  { id: "light-black", label: "Light black", value: "#121212" },
  { id: "dark-gray", label: "Dark gray", value: "#1a1a1a" },
  { id: "gray", label: "Gray", value: "#222222" },
  { id: "dark-blue", label: "Dark blue", value: "#0a0e16" },
  { id: "dark-purple", label: "Dark purple", value: "#100a16" },
] as const;

/** Card / dialog / panel surfaces — slightly lifted from page. */
export const CARD_PRESETS = [
  { id: "ink", label: "Ink", value: "#0f0f0f" },
  { id: "charcoal", label: "Charcoal", value: "#111111" },
  { id: "slate", label: "Slate", value: "#161616" },
  { id: "steel", label: "Steel", value: "#1c1c1c" },
  { id: "blue-ink", label: "Blue ink", value: "#10141c" },
  { id: "purple-ink", label: "Purple ink", value: "#14101a" },
] as const;

export type AccentId = (typeof ACCENT_PRESETS)[number]["id"];
export type PageId = (typeof PAGE_PRESETS)[number]["id"];
export type CardId = (typeof CARD_PRESETS)[number]["id"];

export type ZapThemePrefs = {
  accent: AccentId;
  page: PageId;
  card: CardId;
  /** Master switch for beat-reactive bg and future motion. Default on. */
  animations: boolean;
};

export const DEFAULT_THEME_PREFS: ZapThemePrefs = {
  accent: "coral",
  page: "dark-purple",
  card: "ink",
  animations: true,
};

/** Card fill alpha when animations are on (cymatics show through). */
export const ANIMATIONS_CARD_ALPHA = 0.4;
export const ANIMATIONS_CHROME_ALPHA = 0.72;

export function isAccentId(v: unknown): v is AccentId {
  return ACCENT_PRESETS.some((p) => p.id === v);
}

export function isPageId(v: unknown): v is PageId {
  return PAGE_PRESETS.some((p) => p.id === v);
}

export function isCardId(v: unknown): v is CardId {
  return CARD_PRESETS.some((p) => p.id === v);
}

export function readThemePrefs(): ZapThemePrefs {
  if (typeof localStorage === "undefined") return { ...DEFAULT_THEME_PREFS };
  try {
    const raw = localStorage.getItem(ZAP_THEME_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_THEME_PREFS };
    const parsed = JSON.parse(raw) as Partial<ZapThemePrefs>;
    return {
      accent: isAccentId(parsed.accent) ? parsed.accent : DEFAULT_THEME_PREFS.accent,
      page: isPageId(parsed.page) ? parsed.page : DEFAULT_THEME_PREFS.page,
      card: isCardId(parsed.card) ? parsed.card : DEFAULT_THEME_PREFS.card,
      animations: typeof parsed.animations === "boolean" ? parsed.animations : DEFAULT_THEME_PREFS.animations,
    };
  } catch {
    return { ...DEFAULT_THEME_PREFS };
  }
}

export function writeThemePrefs(prefs: ZapThemePrefs) {
  try {
    localStorage.setItem(ZAP_THEME_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // storage unavailable
  }
}

function accentById(id: AccentId) {
  return ACCENT_PRESETS.find((p) => p.id === id) ?? ACCENT_PRESETS[0];
}

function pageById(id: PageId) {
  return (
    PAGE_PRESETS.find((p) => p.id === id) ??
    PAGE_PRESETS.find((p) => p.id === DEFAULT_THEME_PREFS.page) ??
    PAGE_PRESETS[0]
  );
}

function cardById(id: CardId) {
  return (
    CARD_PRESETS.find((p) => p.id === id) ??
    CARD_PRESETS.find((p) => p.id === DEFAULT_THEME_PREFS.card) ??
    CARD_PRESETS[0]
  );
}

function mixCard(solid: string, alpha: number) {
  return `color-mix(in srgb, ${solid} ${Math.round(alpha * 100)}%, transparent)`;
}

/** Apply prefs to `:root` CSS custom properties + `data-animations`. */
export function applyThemePrefs(prefs: ZapThemePrefs) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const accent = accentById(prefs.accent);
  const page = pageById(prefs.page);
  const card = cardById(prefs.card);
  const animationsOn = prefs.animations !== false;

  root.setAttribute("data-animations", animationsOn ? "on" : "off");

  root.style.setProperty("--background", page.value);
  root.style.setProperty("--atmosphere", `linear-gradient(180deg, ${page.value} 0%, ${page.value} 100%)`);
  root.style.setProperty("--scrollbar-track", page.value);

  root.style.setProperty("--card-solid", card.value);
  const cardFill = animationsOn ? mixCard(card.value, ANIMATIONS_CARD_ALPHA) : card.value;
  const chromeFill = animationsOn ? mixCard(card.value, ANIMATIONS_CHROME_ALPHA) : card.value;

  root.style.setProperty("--background-mid", chromeFill);
  root.style.setProperty("--card", cardFill);
  root.style.setProperty("--card-foreground", "#f3efe9");
  root.style.setProperty("--secondary", cardFill);
  root.style.setProperty("--secondary-foreground", "#f3efe9");
  root.style.setProperty("--muted", cardFill);
  root.style.setProperty("--input", chromeFill);
  root.style.setProperty("--popover", chromeFill);
  root.style.setProperty("--popover-foreground", "#f3efe9");

  root.style.setProperty("--primary", accent.value);
  root.style.setProperty("--primary-foreground", accent.foreground);
  root.style.setProperty("--accent", accent.value);
  root.style.setProperty("--accent-foreground", accent.foreground);
  root.style.setProperty("--positive", accent.value);
  root.style.setProperty("--positive-foreground", accent.foreground);
  root.style.setProperty("--signal", accent.value);
  root.style.setProperty("--ring", accent.value);
  root.style.setProperty("--glow-a", accent.value);
  root.style.setProperty("--scrollbar-thumb-hover", accent.value);
  root.style.setProperty("--frame-player-border", `4px solid ${accent.value}`);
  root.style.setProperty("--frame-shadow", `8px 8px 0 color-mix(in oklab, ${accent.value} 35%, transparent)`);
}

export function persistAndApplyTheme(prefs: ZapThemePrefs) {
  writeThemePrefs(prefs);
  applyThemePrefs(prefs);
}

/** True when the master animations switch is on (DOM attribute). */
export function animationsEnabled(): boolean {
  if (typeof document === "undefined") return DEFAULT_THEME_PREFS.animations;
  return document.documentElement.getAttribute("data-animations") !== "off";
}
