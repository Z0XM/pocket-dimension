import { describe, expect, test } from "bun:test";
import {
  TAG_ICON_CATEGORIES,
  filterTagIconCategories,
  isSystemTagIcon,
  normalizeTagIcon,
  systemTagIconCount,
} from "./tag-icons";

describe("tag-icons", () => {
  test("curated set is large, unique, and categorized", () => {
    expect(TAG_ICON_CATEGORIES.length).toBeGreaterThan(8);
    const all = TAG_ICON_CATEGORIES.flatMap((c) => c.icons.map((x) => x.glyph));
    expect(all.length).toBeGreaterThan(200);
    expect(new Set(all).size).toBe(all.length);
    expect(systemTagIconCount()).toBe(all.length);
  });

  test("normalize accepts only curated icons", () => {
    const sample = TAG_ICON_CATEGORIES[0]!.icons[0]!.glyph;
    expect(normalizeTagIcon(sample)).toBe(sample);
    expect(normalizeTagIcon(`  ${sample}  `)).toBe(sample);
    expect(normalizeTagIcon("")).toBeNull();
    expect(normalizeTagIcon(null)).toBeNull();
    expect(normalizeTagIcon("not-an-icon")).toBeNull();
    expect(isSystemTagIcon(sample)).toBe(true);
    expect(isSystemTagIcon("xyz")).toBe(false);
  });

  test("search filters by keywords and category", () => {
    const music = filterTagIconCategories("headphones");
    expect(music.some((c) => c.icons.some((i) => i.glyph === "🎧"))).toBe(true);

    const india = filterTagIconCategories("india");
    expect(india.some((c) => c.icons.some((i) => i.glyph === "🇮🇳"))).toBe(true);

    const empty = filterTagIconCategories("zzznomatchzzz");
    expect(empty).toEqual([]);
  });
});
