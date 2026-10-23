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

/** Slider ranges — defaults match pre-control look. */
export const MOTION_CARD_OPACITY = { min: 0.15, max: 1, step: 0.05, default: 0.4 } as const;
export const MOTION_ANIM_OPACITY = { min: 0.1, max: 1, step: 0.05, default: 1 } as const;
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
};

export const DEFAULT_THEME_PREFS: ZapThemePrefs = {
  accent: "coral",
  page: "dark-purple",
  card: "ink",
  animations: true,
  animationStyle: "radial",
  cardOpacity: MOTION_CARD_OPACITY.default,
  animationOpacity: MOTION_ANIM_OPACITY.default,
  animationLayer: "behind",
  responseWindowMs: MOTION_RESPONSE_MS.default,
  waveHistoryMs: MOTION_WAVE_HISTORY_MS.default,
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
  return clamp(
    typeof v === "number" ? v : MOTION_WAVE_HISTORY_MS.default,
    MOTION_WAVE_HISTORY_MS.min,
    MOTION_WAVE_HISTORY_MS.max
  );
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
      animationStyle: isAnimationStyleId(parsed.animationStyle)
        ? parsed.animationStyle
        : DEFAULT_THEME_PREFS.animationStyle,
      cardOpacity: clampCardOpacity(parsed.cardOpacity),
      animationOpacity: clampAnimOpacity(parsed.animationOpacity),
      animationLayer: isAnimationLayer(parsed.animationLayer)
        ? parsed.animationLayer
        : DEFAULT_THEME_PREFS.animationLayer,
      responseWindowMs: clampResponseMs(parsed.responseWindowMs),
      waveHistoryMs: clampWaveHistoryMs(parsed.waveHistoryMs),
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
  const card = cardById(prefs.card);
  const animationsOn = prefs.animations !== false;
  const cardOpacity = clampCardOpacity(prefs.cardOpacity);
  const animOpacity = clampAnimOpacity(prefs.animationOpacity);
  const layer = isAnimationLayer(prefs.animationLayer) ? prefs.animationLayer : "behind";
  const responseMs = clampResponseMs(prefs.responseWindowMs);
  const waveMs = clampWaveHistoryMs(prefs.waveHistoryMs);

  root.setAttribute("data-animations", animationsOn ? "on" : "off");
  root.setAttribute(
    "data-animation-style",
    isAnimationStyleId(prefs.animationStyle) ? prefs.animationStyle : DEFAULT_THEME_PREFS.animationStyle
  );
  root.setAttribute("data-animation-layer", layer);
  root.style.setProperty("--zap-anim-opacity", String(animOpacity));
  root.style.setProperty("--zap-response-ms", String(responseMs));
  root.style.setProperty("--zap-wave-history-ms", String(waveMs));

  root.style.setProperty("--background", page.value);
  root.style.setProperty("--atmosphere", `linear-gradient(180deg, ${page.value} 0%, ${page.value} 100%)`);
  root.style.setProperty("--scrollbar-track", page.value);

  root.style.setProperty("--card-solid", card.value);
  const cardFill = animationsOn ? mixCard(card.value, cardOpacity) : card.value;
  const chromeFill = animationsOn ? mixCard(card.value, chromeAlphaFromCard(cardOpacity)) : card.value;

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

/** Active visualizer style from `data-animation-style` (falls back to radial). */
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
  return clampWaveHistoryMs(
    Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--zap-wave-history-ms"))
  );
}
