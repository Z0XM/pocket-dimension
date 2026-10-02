import { describe, expect, test } from "bun:test";
import { DEFAULT_CATEGORIES, DEFAULT_TAGS } from "./default-taxonomy";
import { REFUND_CATEGORY_NAME, SPLIT_RETURN_CATEGORY_NAME } from "./refunds";
import { isBillCategoryName } from "./bill-categories";

describe("default taxonomy", () => {
  test("includes refund and bill categories used by special flows", () => {
    const names = DEFAULT_CATEGORIES.map((category) => category.name);
    expect(names).toContain(REFUND_CATEGORY_NAME);
    expect(names).toContain(SPLIT_RETURN_CATEGORY_NAME);
    expect(names.some((name) => isBillCategoryName(name))).toBe(true);
  });

  test("category and tag names are unique", () => {
    const categoryNames = DEFAULT_CATEGORIES.map((category) => category.name);
    const tagNames = DEFAULT_TAGS.map((tag) => tag.name);
    expect(new Set(categoryNames).size).toBe(categoryNames.length);
    expect(new Set(tagNames).size).toBe(tagNames.length);
  });

  test("seeds both expense and income kinds", () => {
    expect(DEFAULT_CATEGORIES.some((category) => category.kind === "expense")).toBe(true);
    expect(DEFAULT_CATEGORIES.some((category) => category.kind === "income")).toBe(true);
  });
});
