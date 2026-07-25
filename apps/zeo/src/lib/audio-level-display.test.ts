import { describe, expect, it } from "bun:test";
import { AUDIO_LEVEL_DISPLAY_KNEE, mapAudioLevelForDisplay } from "./audio-level-display";

describe("mapAudioLevelForDisplay", () => {
  it("maps silence to empty", () => {
    expect(mapAudioLevelForDisplay(0)).toBe(0);
  });

  it("maps the knee to 75% of the bar", () => {
    expect(mapAudioLevelForDisplay(AUDIO_LEVEL_DISPLAY_KNEE)).toBeCloseTo(0.75, 5);
  });

  it("maps full level to full bar", () => {
    expect(mapAudioLevelForDisplay(1)).toBeCloseTo(1, 5);
  });

  it("clamps out-of-range inputs", () => {
    expect(mapAudioLevelForDisplay(-0.5)).toBe(0);
    expect(mapAudioLevelForDisplay(1.5)).toBeCloseTo(1, 5);
  });

  it("puts mid-speech below the knee into the lower 75%", () => {
    const mid = mapAudioLevelForDisplay(AUDIO_LEVEL_DISPLAY_KNEE / 2);
    expect(mid).toBeCloseTo(0.375, 5);
    expect(mid).toBeLessThan(0.75);
  });

  it("compresses above-knee levels into the top 25%", () => {
    const above = mapAudioLevelForDisplay((AUDIO_LEVEL_DISPLAY_KNEE + 1) / 2);
    expect(above).toBeGreaterThan(0.75);
    expect(above).toBeLessThan(1);
  });
});
