import { describe, expect, test } from "bun:test";
import { collectTagNames, evaluateTagQuery, formatTagQuery, parseTagQuery } from "./tag-query";

describe("parseTagQuery", () => {
  test("parses love and (soft not upbeat)", () => {
    const r = parseTagQuery("love and (soft not upbeat)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ast).toEqual({
      type: "and",
      children: [
        { type: "tag", name: "love" },
        {
          type: "and",
          children: [
            { type: "tag", name: "soft" },
            { type: "not", child: { type: "tag", name: "upbeat" } },
          ],
        },
      ],
    });
  });

  test("parses or / unary not / parens", () => {
    const r = parseTagQuery("(chill or soft) and not sad");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(formatTagQuery(r.ast)).toBe("(chill or soft) and not sad");
  });

  test("implicit and between tags", () => {
    const r = parseTagQuery("love soft");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ast.type).toBe("and");
  });

  test("rejects empty / bad tokens", () => {
    expect(parseTagQuery("").ok).toBe(false);
    expect(parseTagQuery("love and").ok).toBe(false);
    expect(parseTagQuery("(love").ok).toBe(false);
  });
});

describe("evaluateTagQuery", () => {
  const tagNameToId = new Map([
    ["love", "t-love"],
    ["soft", "t-soft"],
    ["upbeat", "t-upbeat"],
  ]);
  const tagsByAsset = new Map<string, Set<string>>([
    ["a1", new Set(["t-love", "t-soft"])],
    ["a2", new Set(["t-love", "t-soft", "t-upbeat"])],
    ["a3", new Set(["t-love", "t-upbeat"])],
    ["a4", new Set(["t-soft"])],
  ]);
  const universe = new Set(["a1", "a2", "a3", "a4"]);

  test("love and (soft not upbeat) matches a1 only", () => {
    const parsed = parseTagQuery("love and (soft not upbeat)");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const out = evaluateTagQuery(parsed.ast, { universe, tagsByAsset, tagNameToId });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect([...out.assetIds].sort()).toEqual(["a1"]);
  });

  test("unknown tag errors", () => {
    const parsed = parseTagQuery("love and missing");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const out = evaluateTagQuery(parsed.ast, { universe, tagsByAsset, tagNameToId });
    expect(out.ok).toBe(false);
  });

  test("collectTagNames", () => {
    const parsed = parseTagQuery("Love AND Soft");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect([...collectTagNames(parsed.ast)].sort()).toEqual(["love", "soft"]);
  });
});
