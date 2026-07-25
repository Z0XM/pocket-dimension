/** Knee where normal speech fills 75% of the meter; louder peaks use the top 25%. */
export const AUDIO_LEVEL_DISPLAY_KNEE = 0.3;

/**
 * Map a raw 0–1 audio level to a nonlinear display value.
 * Levels at/under the knee map into [0, 0.75]; levels above map into (0.75, 1].
 */
export function mapAudioLevelForDisplay(level: number, knee = AUDIO_LEVEL_DISPLAY_KNEE): number {
  const x = Math.min(1, Math.max(0, level));
  const k = Math.min(1, Math.max(0.0001, knee));

  if (x <= k) {
    return 0.75 * (x / k);
  }

  return 0.75 + 0.25 * ((x - k) / (1 - k));
}
