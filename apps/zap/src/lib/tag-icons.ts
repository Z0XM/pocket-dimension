/** Colorful system icon set for Zap tags (emoji glyphs). Categories keep the admin picker scannable. */

export type TagIconCategory = {
  id: string;
  label: string;
  icons: readonly string[];
};

export const TAG_ICON_CATEGORIES: readonly TagIconCategory[] = [
  {
    id: "mood",
    label: "Mood",
    icons: ["🔥", "❄️", "😌", "😴", "😤", "😭", "😍", "😈", "👻", "🫠", "⚡", "💫", "🌈", "☀️", "🌙", "✨"],
  },
  {
    id: "genre",
    label: "Genre / vibe",
    icons: ["🎧", "🎹", "🎸", "🥁", "🎷", "🎺", "🎻", "🎤", "🎶", "🎼", "💿", "📻", "🔊", "🔉", "🕺", "💃"],
  },
  {
    id: "energy",
    label: "Energy",
    icons: ["🚀", "💥", "🌪️", "🌋", "🌀", "☄️", "🔋", "🏃", "🏋️", "🎯", "🏁", "⭐", "🌟", "💪", "🥊", "🥳"],
  },
  {
    id: "nature",
    label: "Nature",
    icons: ["🌿", "🌸", "🌺", "🌻", "🍀", "🌴", "🌵", "🍄", "🌊", "🏔️", "🌅", "🌄", "🌌", "☁️", "🌧️", "🍃"],
  },
  {
    id: "places",
    label: "Places",
    icons: ["🏠", "🏙️", "🌃", "🌉", "🏖️", "⛺", "🛸", "🚗", "✈️", "🚢", "🗺️", "🗽", "🏯", "⛪", "🏟️", "🎬"],
  },
  {
    id: "food",
    label: "Food & drink",
    icons: ["☕", "🍵", "🍺", "🍷", "🍸", "🧋", "🍕", "🍔", "🌮", "🍜", "🍣", "🍩", "🍦", "🍫", "🍿", "🎂"],
  },
  {
    id: "animals",
    label: "Animals",
    icons: ["🐱", "🐶", "🦊", "🐺", "🐯", "🦁", "🐻", "🐼", "🐨", "🐸", "🦉", "🦅", "🦋", "🐝", "🐉", "🦄"],
  },
  {
    id: "objects",
    label: "Objects",
    icons: ["💎", "🔮", "🪄", "🧪", "💊", "🕹️", "🎮", "🎲", "🃏", "🧩", "📚", "📝", "💡", "🔑", "🎁", "❤️"],
  },
  {
    id: "flags",
    label: "Marks",
    icons: ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫", "⚪", "🟤", "🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "⬛"],
  },
] as const;

const ALL = new Set(TAG_ICON_CATEGORIES.flatMap((c) => [...c.icons]));

/** True when `value` is one of the curated system icons. */
export function isSystemTagIcon(value: string | null | undefined): boolean {
  if (!value) return false;
  return ALL.has(value.trim());
}

/** Normalize admin input: trim, accept only curated icons, else null. */
export function normalizeTagIcon(raw: unknown): string | null {
  if (raw == null) return null;
  const value = String(raw).trim();
  if (!value) return null;
  return ALL.has(value) ? value : null;
}

export function tagIconOrEmpty(icon: string | null | undefined): string {
  return icon && ALL.has(icon) ? icon : "";
}
