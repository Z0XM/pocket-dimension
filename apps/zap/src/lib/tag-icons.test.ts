import { describe, expect, test } from "bun:test";
import { TAG_ICON_CATEGORIES, isSystemTagIcon, normalizeTagIcon } from "./tag-icons";

describe("tag-icons", () => {
  test("curated set is non-empty and categorized", () => {
    expect(TAG_ICON_CATEGORIES.length).toBeGreaterThan(5);
    const all = TAG_ICON_CATEGORIES.flatMap((c) => c.icons);
    expect(all.length).toBeGreaterThan(40);
    expect(new Set(all).size).toBe(all.length);
  });

  test("normalize accepts only curated icons", () => {
    const sample = TAG_ICON_CATEGORIES[0]!.icons[0]!;
    expect(normalizeTagIcon(sample)).toBe(sample);
    expect(normalizeTagIcon(`  ${sample}  `)).toBe(sample);
    expect(normalizeTagIcon("")).toBeNull();
    expect(normalizeTagIcon(null)).toBeNull();
    expect(normalizeTagIcon("not-an-icon")).toBeNull();
    expect(isSystemTagIcon(sample)).toBe(true);
    expect(isSystemTagIcon("xyz")).toBe(false);
  });
});
