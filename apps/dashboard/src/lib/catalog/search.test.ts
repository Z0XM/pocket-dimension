import { describe, expect, it } from "bun:test";
import { buildSnippet, matchesQuery, searchCorpus } from "./search";
import type { SearchCorpusEntry } from "$lib/types";

const corpus: SearchCorpusEntry[] = [
  {
    kind: "docs",
    id: "planning-prd-md",
    title: "PRD Dashboard",
    tree: "pocket-dimension",
    text: "The dashboard must support FR-12 search across artifact bodies.",
    href: "/docs/planning-artifacts/prd.md?tree=pocket-dimension",
  },
  {
    kind: "feature",
    id: "FR-12",
    title: "Search Artifacts",
    tree: "pocket-dimension",
    text: "FR-12 Search Artifacts",
    href: "/docs/planning-artifacts/prd.md?tree=pocket-dimension#fr-12",
  },
  {
    kind: "epic",
    id: "epic-4-search",
    title: "Epic 4 Search",
    tree: "pocket-dimension",
    text: "Epic about search and catalog features.",
    href: "/epics/epic-4-search?tree=pocket-dimension",
  },
  {
    kind: "story",
    id: "4-1-search",
    title: "Search content",
    tree: "pocket-dimension",
    text: "Story for searching artifact body text.",
    href: "/stories/4-1-search?tree=pocket-dimension",
  },
  {
    kind: "docs",
    id: "zeo-unique-phrase",
    title: "Zeo Doc",
    tree: "zeo",
    text: "zeo-only-unique-phrase-here for tree filter tests.",
    href: "/docs/zeo-doc.md?tree=zeo",
  },
];

describe("matchesQuery", () => {
  it("matches case-insensitive substring in body not title alone", () => {
    expect(matchesQuery("artifact bodies contain FR-12 tokens", "fr-12")).toBe(true);
    expect(matchesQuery("Title Only", "body phrase")).toBe(false);
  });

  it("matches when every whitespace token appears", () => {
    expect(matchesQuery("search across artifact bodies", "search bodies")).toBe(true);
    expect(matchesQuery("search across artifact bodies", "search missing")).toBe(false);
  });

  it("returns false for empty query", () => {
    expect(matchesQuery("anything", "")).toBe(false);
    expect(matchesQuery("anything", "   ")).toBe(false);
  });
});

describe("buildSnippet", () => {
  it("includes matched text region", () => {
    const snippet = buildSnippet("prefix FR-12 suffix text here", "FR-12");
    expect(snippet.toLowerCase()).toContain("fr-12");
  });

  it("returns empty for blank query", () => {
    expect(buildSnippet("text", "")).toBe("");
  });
});

describe("searchCorpus", () => {
  it("returns empty for whitespace-only query", () => {
    expect(searchCorpus(corpus, "")).toEqual([]);
    expect(searchCorpus(corpus, "   ")).toEqual([]);
  });

  it("finds body matches with stable group order", () => {
    const hits = searchCorpus(corpus, "FR-12");
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits.some((h) => h.kind === "feature")).toBe(true);
    expect(hits.some((h) => h.kind === "docs")).toBe(true);

    const kinds = hits.map((h) => h.kind);
    const featureIdx = kinds.indexOf("feature");
    const docsIdx = kinds.indexOf("docs");
    expect(featureIdx).toBeLessThan(docsIdx);
  });

  it("narrows to a single tree", () => {
    const hits = searchCorpus(corpus, "zeo-only-unique-phrase", { tree: "pocket-dimension" });
    expect(hits).toHaveLength(0);

    const zeoHits = searchCorpus(corpus, "zeo-only-unique-phrase", { tree: "zeo" });
    expect(zeoHits).toHaveLength(1);
    expect(zeoHits[0]?.tree).toBe("zeo");
  });

  it("returns hit shape with snippet", () => {
    const hits = searchCorpus(corpus, "FR-12");
    expect(hits.length).toBeGreaterThan(0);
    const hit = hits[0]!;
    expect(hit.kind).toBeDefined();
    expect(hit.id).toBeDefined();
    expect(hit.title).toBeDefined();
    expect(typeof hit.snippet).toBe("string");
    expect(hit.href).toBeDefined();
    expect(hit.tree).toBeDefined();
    expect(hit.snippet.toLowerCase()).toContain("fr-12");
  });
});
