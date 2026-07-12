import { randomInt } from "node:crypto";

const ADJECTIVES = [
  "amber",
  "bold",
  "brave",
  "bright",
  "calm",
  "clear",
  "cool",
  "cosy",
  "crisp",
  "deep",
  "fair",
  "fresh",
  "gentle",
  "golden",
  "happy",
  "kind",
  "light",
  "lucky",
  "mint",
  "neat",
  "noble",
  "prime",
  "pure",
  "quick",
  "quiet",
  "silver",
  "smart",
  "sunny",
  "swift",
  "warm",
  "wise",
  "zen",
] as const;

const NOUNS = [
  "bay",
  "cloud",
  "cove",
  "dawn",
  "dusk",
  "fern",
  "field",
  "fox",
  "glen",
  "grove",
  "hawk",
  "lake",
  "lane",
  "mint",
  "moon",
  "nest",
  "oak",
  "owl",
  "path",
  "peak",
  "pine",
  "plum",
  "reef",
  "river",
  "rose",
  "sage",
  "spark",
  "star",
  "stone",
  "wave",
] as const;

function pickWord<T extends readonly string[]>(words: T) {
  return words[randomInt(words.length)]!;
}

/** Short, human-readable room code like `calm-river` or `bold-falcon-42`. */
export function generateRoomSlug(options?: { suffix?: number }) {
  const adjective = pickWord(ADJECTIVES);
  const noun = pickWord(NOUNS);
  const base = `${adjective}-${noun}`;

  if (options?.suffix !== undefined) {
    return `${base}-${options.suffix}`;
  }

  return base;
}
