import { describe, expect, test } from "bun:test";
import { deriveDraftSlug, deriveDraftTitle, normalizeCreatorRating, normalizeDraftBody, pieceToPages } from "./pieces";
import type { DbPiece } from "./pieces";

describe("pieces helpers", () => {
  test("normalizeDraftBody trims and rejects empty content", () => {
    expect(normalizeDraftBody("  hello  ")).toBe("hello");
    expect(normalizeDraftBody("   ")).toBeNull();
  });

  test("deriveDraftTitle uses first non-empty line", () => {
    expect(deriveDraftTitle("\n\nMy poem\nSecond line")).toBe("My poem");
  });

  test("deriveDraftSlug is stable prefix with random suffix", () => {
    expect(deriveDraftSlug("My Poem")).toMatch(/^draft-my-poem-[a-f0-9]{8}$/);
  });

  test("normalizeCreatorRating enforces integer 0-10", () => {
    expect(normalizeCreatorRating(8)).toBe(8);
    expect(() => normalizeCreatorRating(11)).toThrow();
    expect(() => normalizeCreatorRating(7.5)).toThrow();
  });

  test("pieceToPages prefers bodyDocument page breaks", () => {
    const piece = {
      bodyPlain: "ignored",
      bodyDocument: {
        type: "doc",
        content: [
          { type: "paragraph", children: [{ type: "text", text: "A" }] },
          { type: "pageBreak" },
          { type: "paragraph", children: [{ type: "text", text: "B" }] },
        ],
      },
    } as DbPiece;

    expect(pieceToPages(piece)).toEqual(["A", "B"]);
  });
});
