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

/**
 * Page grounds — near-black neutrals plus dark tints matching each accent
 * (same depth family as dark purple `#100a16`).
 */
export const PAGE_PRESETS = [
  { id: "dark-black", label: "Dark black", value: "#050505" },
  { id: "black", label: "Black", value: "#0a0a0a" },
  { id: "dark-coral", label: "Dark coral", value: "#160a08" },
  { id: "dark-red", label: "Dark red", value: "#160808" },
  { id: "dark-purple", label: "Dark purple", value: "#100a16" },
  { id: "dark-pink", label: "Dark pink", value: "#160a10" },
  { id: "dark-cream", label: "Dark cream", value: "#12100e" },
  { id: "dark-yellow", label: "Dark yellow", value: "#161208" },
  { id: "dark-green", label: "Dark green", value: "#08140e" },
  { id: "dark-blue", label: "Dark blue", value: "#0a0e16" },
] as const;

/**
 * Shared chrome surface for header, queue dock, floating panels, play tiles, etc.
 * Fixed (not page-tinted) so the bar stays the same across page backgrounds.
 */
export const DEFAULT_CARD_SURFACE = "#0f0f0f";

/** @deprecated Kept for reading old localStorage `card` ids; display uses DEFAULT_CARD_SURFACE. */
export const CARD_PRESETS = [
  { id: "ink", label: "Ink", value: DEFAULT_CARD_SURFACE },
  { id: "charcoal", label: "Charcoal", value: "#111111" },
  { id: "slate", label: "Slate", value: "#161616" },
  { id: "steel", label: "Steel", value: "#1c1c1c" },
  { id: "blue-ink", label: "Blue ink", value: "#10141c" },
  { id: "purple-ink", label: "Purple ink", value: "#14101a" },
] as const;

/**
 * Beat-reactive visualizer styles (Theme → Motion).
 * Each style must sync to live playback via the shared Web Audio analyser.
 * Removed lattice variants (wave/noise/bars/bloom/vortex) migrate to `radial`.
 */
export const ANIMATION_STYLES = [
  { id: "radial", label: "Radial", blurb: "Dot lattice — center-out beat rings" },
  { id: "scope", label: "Oscilloscope", blurb: "ECG-style time-domain waveform" },
  { id: "spectrum", label: "Spectrum", blurb: "Classic frequency bars" },
  { id: "ring", label: "Spectrum ring", blurb: "Circular frequency spectrum" },
  { id: "mirror", label: "Mirrored wave", blurb: "Mirrored time-domain waveform" },
] as const;

export type AccentId = (typeof ACCENT_PRESETS)[number]["id"];
export type PageId = (typeof PAGE_PRESETS)[number]["id"];
export type CardId = (typeof CARD_PRESETS)[number]["id"];
export type AnimationStyleId = (typeof ANIMATION_STYLES)[number]["id"];
export type AnimationLayer = "behind" | "top";

/** How tags appear on catalogue / track rows. */
export const CATALOGUE_TAG_DISPLAYS = [
  { id: "text", label: "Text badges", blurb: "Name only, in a chip" },
  { id: "icons", label: "Icons only", blurb: "Glyph when set; plain, no chip" },
  { id: "both", label: "Icon + text", blurb: "Icon and name together in a chip" },
] as const;

export type CatalogueTagDisplay = (typeof CATALOGUE_TAG_DISPLAYS)[number]["id"];

export const ZAP_THEME_EVENT = "zap:theme";

/** Slider ranges — defaults match current Theme → Motion baseline. */
export const MOTION_CARD_OPACITY = { min: 0.15, max: 1, step: 0.05, default: 1 } as const;
export const MOTION_ANIM_OPACITY = { min: 0.1, max: 1, step: 0.05, default: 0.4 } as const;
/** 0 = instant per-frame; max aggregates peak-biased energy over this many ms. */
export const MOTION_RESPONSE_MS = { min: 0, max: 2000, step: 50, default: 0 } as const;
/** 0 = live analyser buffer only; max ≈ 5s scrolling history (scope / mirror). */
export const MOTION_WAVE_HISTORY_MS = { min: 0, max: 5000, step: 100, default: 0 } as const;

export type ZapThemePrefs = {
  accent: AccentId;
  page: PageId;
  card: CardId;
  /** Master switch for beat-reactive bg and future motion. Default on. */
  animations: boolean;
  /** Visualizer style when animations are on. */
  animationStyle: AnimationStyleId;
  /** Card surface alpha when animations on (0.15–1). Ignored when animations off. */
  cardOpacity: number;
  /** Visualizer canvas opacity (0.1–1). */
  animationOpacity: number;
  /** Canvas under UI vs over UI. */
  animationLayer: AnimationLayer;
  /**
   * Analyser aggregation window in ms. 0 = instant.
   * >0 → peak-biased blend (55% peak / 45% avg) over the window.
   */
  responseWindowMs: number;
  /** Oscilloscope / mirrored-wave history window in ms (0–5000). 0 = live buffer only. */
  waveHistoryMs: number;
  /** Catalogue / track-row tag presentation. */
  catalogueTagDisplay: CatalogueTagDisplay;
  /** Force tag icons/emoji to grayscale everywhere they’re shown. */
  monochromeIcons: boolean;
};

export const DEFAULT_THEME_PREFS: ZapThemePrefs = {
  accent: "coral",
  page: "dark-purple",
  card: "ink",
  animations: true,
  animationStyle: "mirror",
  cardOpacity: MOTION_CARD_OPACITY.default, // 100%
  animationOpacity: MOTION_ANIM_OPACITY.default, // 40%
  animationLayer: "top",
  responseWindowMs: MOTION_RESPONSE_MS.default, // Instant
  waveHistoryMs: MOTION_WAVE_HISTORY_MS.default, // Live
  catalogueTagDisplay: "text",
  monochromeIcons: false,
};

export function isAccentId(v: unknown): v is AccentId {
  return ACCENT_PRESETS.some((p) => p.id === v);
}

export function isPageId(v: unknown): v is PageId {
  return PAGE_PRESETS.some((p) => p.id === v);
}

export function isCardId(v: unknown): v is CardId {
  return CARD_PRESETS.some((p) => p.id === v);
}

export function isAnimationStyleId(v: unknown): v is AnimationStyleId {
  return ANIMATION_STYLES.some((p) => p.id === v);
}

export function isAnimationLayer(v: unknown): v is AnimationLayer {
  return v === "behind" || v === "top";
}

export function isCatalogueTagDisplay(v: unknown): v is CatalogueTagDisplay {
  return CATALOGUE_TAG_DISPLAYS.some((p) => p.id === v);
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function clampCardOpacity(v: unknown): number {
  return clamp(typeof v === "number" ? v : MOTION_CARD_OPACITY.default, MOTION_CARD_OPACITY.min, MOTION_CARD_OPACITY.max);
}

function clampAnimOpacity(v: unknown): number {
  return clamp(typeof v === "number" ? v : MOTION_ANIM_OPACITY.default, MOTION_ANIM_OPACITY.min, MOTION_ANIM_OPACITY.max);
}

function clampResponseMs(v: unknown): number {
  return clamp(typeof v === "number" ? v : MOTION_RESPONSE_MS.default, MOTION_RESPONSE_MS.min, MOTION_RESPONSE_MS.max);
}

function clampWaveHistoryMs(v: unknown): number {
  return clamp(typeof v === "number" ? v : MOTION_WAVE_HISTORY_MS.default, MOTION_WAVE_HISTORY_MS.min, MOTION_WAVE_HISTORY_MS.max);
}

export function readThemePrefs(): ZapThemePrefs {
  if (typeof localStorage === "undefined") return { ...DEFAULT_THEME_PREFS };
  try {
    const raw = localStorage.getItem(ZAP_THEME_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_THEME_PREFS };
    const parsed = JSON.parse(raw) as Partial<ZapThemePrefs>;
    const prefs: ZapThemePrefs = {
      accent: isAccentId(parsed.accent) ? parsed.accent : DEFAULT_THEME_PREFS.accent,
      page: isPageId(parsed.page) ? parsed.page : DEFAULT_THEME_PREFS.page,
      card: isCardId(parsed.card) ? parsed.card : DEFAULT_THEME_PREFS.card,
      animations: typeof parsed.animations === "boolean" ? parsed.animations : DEFAULT_THEME_PREFS.animations,
      animationStyle: isAnimationStyleId(parsed.animationStyle) ? parsed.animationStyle : DEFAULT_THEME_PREFS.animationStyle,
      cardOpacity: clampCardOpacity(parsed.cardOpacity),
      animationOpacity: clampAnimOpacity(parsed.animationOpacity),
      animationLayer: isAnimationLayer(parsed.animationLayer) ? parsed.animationLayer : DEFAULT_THEME_PREFS.animationLayer,
      responseWindowMs: clampResponseMs(parsed.responseWindowMs),
      waveHistoryMs: clampWaveHistoryMs(parsed.waveHistoryMs),
      catalogueTagDisplay: isCatalogueTagDisplay(parsed.catalogueTagDisplay)
        ? parsed.catalogueTagDisplay
        : DEFAULT_THEME_PREFS.catalogueTagDisplay,
      monochromeIcons: typeof parsed.monochromeIcons === "boolean" ? parsed.monochromeIcons : DEFAULT_THEME_PREFS.monochromeIcons,
    };
    // Migrate removed styles (wave/noise/bars/bloom/vortex/…) back to radial.
    if (parsed.animationStyle !== prefs.animationStyle) {
      writeThemePrefs(prefs);
    }
    return prefs;
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
  return PAGE_PRESETS.find((p) => p.id === id) ?? PAGE_PRESETS.find((p) => p.id === DEFAULT_THEME_PREFS.page) ?? PAGE_PRESETS[0];
}

function mixCard(solid: string, alpha: number) {
  return `color-mix(in srgb, ${solid} ${Math.round(alpha * 100)}%, transparent)`;
}

/** Chrome slightly more opaque than cards so headers stay readable. */
function chromeAlphaFromCard(cardOpacity: number) {
  return clamp(cardOpacity + (1 - cardOpacity) * 0.533, 0.2, 1);
}

/** Apply prefs to `:root` CSS custom properties + `data-animations`. */
export function applyThemePrefs(prefs: ZapThemePrefs) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const accent = accentById(prefs.accent);
  const page = pageById(prefs.page);
  // One shared surface for header / dock / cards — not tied to page tint.
  const cardSolid = DEFAULT_CARD_SURFACE;
  const animationsOn = prefs.animations !== false;
  const cardOpacity = clampCardOpacity(prefs.cardOpacity);
  const animOpacity = clampAnimOpacity(prefs.animationOpacity);
  const layer = isAnimationLayer(prefs.animationLayer) ? prefs.animationLayer : DEFAULT_THEME_PREFS.animationLayer;
  const responseMs = clampResponseMs(prefs.responseWindowMs);
  const waveMs = clampWaveHistoryMs(prefs.waveHistoryMs);

  root.setAttribute("data-animations", animationsOn ? "on" : "off");
  root.setAttribute("data-animation-style", isAnimationStyleId(prefs.animationStyle) ? prefs.animationStyle : DEFAULT_THEME_PREFS.animationStyle);
  root.setAttribute("data-animation-layer", layer);
  root.setAttribute(
    "data-catalogue-tags",
    isCatalogueTagDisplay(prefs.catalogueTagDisplay) ? prefs.catalogueTagDisplay : DEFAULT_THEME_PREFS.catalogueTagDisplay
  );
  root.setAttribute("data-monochrome-icons", prefs.monochromeIcons ? "on" : "off");
  root.style.setProperty("--zap-anim-opacity", String(animOpacity));
  root.style.setProperty("--zap-response-ms", String(responseMs));
  root.style.setProperty("--zap-wave-history-ms", String(waveMs));

  root.style.setProperty("--background", page.value);
  root.style.setProperty("--atmosphere", `linear-gradient(180deg, ${page.value} 0%, ${page.value} 100%)`);
  root.style.setProperty("--scrollbar-track", page.value);

  root.style.setProperty("--card-solid", cardSolid);
  const cardFill = animationsOn ? mixCard(cardSolid, cardOpacity) : cardSolid;
  const chromeFill = animationsOn ? mixCard(cardSolid, chromeAlphaFromCard(cardOpacity)) : cardSolid;

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
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ZAP_THEME_EVENT));
  }
}

/** Active catalogue tag display mode (DOM attribute, then storage). */
export function readCatalogueTagDisplay(): CatalogueTagDisplay {
  if (typeof document !== "undefined") {
    const v = document.documentElement.getAttribute("data-catalogue-tags");
    if (isCatalogueTagDisplay(v)) return v;
  }
  return readThemePrefs().catalogueTagDisplay;
}

/** Whether tag icons should render grayscale. */
export function readMonochromeIcons(): boolean {
  if (typeof document !== "undefined") {
    const v = document.documentElement.getAttribute("data-monochrome-icons");
    if (v === "on") return true;
    if (v === "off") return false;
  }
  return readThemePrefs().monochromeIcons;
}

/** True when the master animations switch is on (DOM attribute). */
export function animationsEnabled(): boolean {
  if (typeof document === "undefined") return DEFAULT_THEME_PREFS.animations;
  return document.documentElement.getAttribute("data-animations") !== "off";
}

/** Active visualizer style from `data-animation-style` (falls back to default). */
export function readAnimationStyle(): AnimationStyleId {
  if (typeof document === "undefined") return DEFAULT_THEME_PREFS.animationStyle;
  const v = document.documentElement.getAttribute("data-animation-style");
  return isAnimationStyleId(v) ? v : DEFAULT_THEME_PREFS.animationStyle;
}

export function readResponseWindowMs(): number {
  if (typeof document === "undefined") return DEFAULT_THEME_PREFS.responseWindowMs;
  return clampResponseMs(Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--zap-response-ms")));
}

export function readWaveHistoryMs(): number {
  if (typeof document === "undefined") return DEFAULT_THEME_PREFS.waveHistoryMs;
  return clampWaveHistoryMs(Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--zap-wave-history-ms")));
}
