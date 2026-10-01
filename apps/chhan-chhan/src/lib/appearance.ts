export const APPEARANCE_STORAGE_KEY = "chhan-appearance";

export const FONT_IDS = ["virgil", "architects", "gaegu", "indie", "kalam", "virgil-kalam", "architects-gaegu", "indie-kalam"] as const;

export const PAPER_IDS = ["plain", "rough", "lines", "lines-gray", "grid", "grid-gray", "dots", "dots-gray"] as const;

export type FontId = (typeof FONT_IDS)[number];
export type PaperId = (typeof PAPER_IDS)[number];

export type Appearance = {
  fonts: FontId;
  paper: PaperId;
};

export const DEFAULT_APPEARANCE: Appearance = {
  fonts: "virgil",
  paper: "plain",
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
  { id: "rough", label: "rough (softer)" },
  { id: "lines", label: "lines · blue" },
  { id: "lines-gray", label: "lines · gray" },
  { id: "grid", label: "grid · blue" },
  { id: "grid-gray", label: "grid · gray" },
  { id: "dots", label: "dots · blue" },
  { id: "dots-gray", label: "dots · gray" },
];

function isFontId(value: unknown): value is FontId {
  return typeof value === "string" && (FONT_IDS as readonly string[]).includes(value);
}

function isPaperId(value: unknown): value is PaperId {
  return typeof value === "string" && (PAPER_IDS as readonly string[]).includes(value);
}

export function normalizeAppearance(input: Partial<Appearance> | null | undefined): Appearance {
  return {
    fonts: isFontId(input?.fonts) ? input.fonts : DEFAULT_APPEARANCE.fonts,
    paper: isPaperId(input?.paper) ? input.paper : DEFAULT_APPEARANCE.paper,
  };
}

export function readAppearance(): Appearance {
  if (typeof localStorage === "undefined") return { ...DEFAULT_APPEARANCE };
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APPEARANCE };
    return normalizeAppearance(JSON.parse(raw) as Partial<Appearance>);
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function writeAppearance(appearance: Appearance): void {
  if (typeof localStorage === "undefined") return;
  const next = normalizeAppearance(appearance);
  localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(next));
}

export function applyAppearanceToDocument(appearance: Appearance = readAppearance()): Appearance {
  const next = normalizeAppearance(appearance);
  if (typeof document === "undefined") return next;
  document.documentElement.setAttribute("data-fonts", next.fonts);
  document.documentElement.setAttribute("data-paper", next.paper);
  return next;
}

export function setAppearance(partial: Partial<Appearance>): Appearance {
  const next = normalizeAppearance({ ...readAppearance(), ...partial });
  writeAppearance(next);
  return applyAppearanceToDocument(next);
}
