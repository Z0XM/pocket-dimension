import { describe, expect, test } from "bun:test";
import { parseAllRhymes } from "../src/lib/rhymes.ts";

const sampleModules = {
  "../assets/rhymes/public.md": `---
title: Public Piece
order: 1
visibility: public
rating: 8
tags: ["Feel Good"]
thought_on: "2024/11/23"
status: "Instagram"
phase: "10/10 Poet"
reader_mode: paged
---
Line one

---

Line two`,
};

describe("markdown import source parsing", () => {
  test("parseAllRhymes preserves slug and frontmatter needed for import", () => {
    const rhymes = parseAllRhymes(sampleModules);
    expect(rhymes).toHaveLength(1);
    expect(rhymes[0]?.slug).toBe("public-piece-1");
    expect(rhymes[0]?.pages).toHaveLength(2);
  });
});
