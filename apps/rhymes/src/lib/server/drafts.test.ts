import { describe, expect, test } from "bun:test";
import { deriveDraftSlug, deriveDraftTitle, normalizeDraftBody } from "./drafts";

describe("drafts", () => {
  test("normalizeDraftBody rejects empty or whitespace-only input", () => {
    expect(normalizeDraftBody("")).toBeNull();
    expect(normalizeDraftBody("   \n\t  ")).toBeNull();
    expect(normalizeDraftBody("  hello  ")).toBe("hello");
  });

  test("deriveDraftTitle uses the first non-empty line", () => {
    expect(deriveDraftTitle("\n\nFirst line\nSecond line")).toBe("First line");
    expect(deriveDraftTitle("   ")).toBe("Untitled draft");
  });

  test("deriveDraftSlug creates a stable draft prefix", () => {
    const slug = deriveDraftSlug("Moonlight");
    expect(slug.startsWith("draft-moonlight-")).toBe(true);
  });
});
