import { randomInt } from "node:crypto";

/** Same alphabet as session join codes — unambiguous uppercase alphanumerics. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Short share/follow code (e.g. `K7M2QX`) — unique per playlist. */
export function generateShareCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)]!;
  }
  return out;
}

export function normalizeShareCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
