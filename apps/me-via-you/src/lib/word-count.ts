export const PRIMARY_ANSWER_TARGET_WORDS = 3;
export const PRIMARY_ANSWER_MAX_WORDS = 6;

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

export function validatePrimaryAnswer(text: string): { ok: true } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: "Please enter an answer." };
  }

  const words = countWords(trimmed);
  if (words > PRIMARY_ANSWER_MAX_WORDS) {
    return { ok: false, error: `Keep it short — ${PRIMARY_ANSWER_MAX_WORDS} words max.` };
  }

  return { ok: true };
}
