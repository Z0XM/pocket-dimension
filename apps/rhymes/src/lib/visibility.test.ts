import { describe, expect, test } from "bun:test";
import { parseAllRhymes, parseRhymes } from "./rhymes";
import { filterPublicRhymes, isPubliclyVisible } from "./visibility";

const sampleModules = {
  "../assets/rhymes/public.md": `---
title: Public Piece
order: 1
visibility: public
---
Hello world`,
  "../assets/rhymes/hidden.md": `---
title: Hidden Piece
order: 2
visibility: hidden
---
Should not appear`,
  "../assets/rhymes/draft.md": `---
title: Draft Piece
order: 3
visibility: draft
---
Also hidden`,
};

describe("visibility", () => {
  test("isPubliclyVisible only allows public visibility", () => {
    expect(isPubliclyVisible("public")).toBe(true);
    expect(isPubliclyVisible("hidden")).toBe(false);
    expect(isPubliclyVisible("draft")).toBe(false);
  });

  test("parseRhymes excludes hidden and draft pieces", () => {
    const rhymes = parseRhymes(sampleModules);
    expect(rhymes).toHaveLength(1);
    expect(rhymes[0]?.slug).toBe("public-piece-1");
  });

  test("parseAllRhymes keeps every piece for future auth-aware loaders", () => {
    const rhymes = parseAllRhymes(sampleModules);
    expect(rhymes).toHaveLength(3);
  });

  test("filterPublicRhymes mirrors public reader catalog rules", () => {
    const rhymes = filterPublicRhymes(parseAllRhymes(sampleModules));
    expect(rhymes.map((rhyme) => rhyme.visibility)).toEqual(["public"]);
  });
});
