import { describe, expect, test } from "bun:test";
import { MAX_CUSTOM_TAGS_PER_ADD, parseCustomTagNames, readCustomTagNamesFromForm, readCustomTagNamesFromJson, withDraft } from "./custom-tags";

describe("parseCustomTagNames", () => {
  test("keeps several distinct names in order", () => {
    expect(parseCustomTagNames(["chill", "late night", "gym"])).toEqual(["chill", "late night", "gym"]);
  });

  test("splits comma lists and trims / collapses whitespace", () => {
    expect(parseCustomTagNames(["  road   trip , focus,, "])).toEqual(["road trip", "focus"]);
  });

  test("dedupes by slug (case / punctuation insensitive)", () => {
    expect(parseCustomTagNames(["Late Night", "late-night", "LATE NIGHT!"])).toEqual(["Late Night"]);
  });

  test("drops names with no slug and non-strings", () => {
    expect(parseCustomTagNames(["!!!", null, 42, undefined, "ok"])).toEqual(["ok"]);
  });

  test("caps the number of tags", () => {
    const many = Array.from({ length: MAX_CUSTOM_TAGS_PER_ADD + 5 }, (_, i) => `tag${i}`);
    expect(parseCustomTagNames(many)).toHaveLength(MAX_CUSTOM_TAGS_PER_ADD);
  });
});

describe("custom tag readers", () => {
  test("form: repeated customTags plus legacy customTag", () => {
    const form = new FormData();
    form.append("customTags", "chill");
    form.append("customTags", "gym");
    form.set("customTag", "focus, chill");
    expect(readCustomTagNamesFromForm(form)).toEqual(["chill", "gym", "focus"]);
  });

  test("json: customTags array plus legacy customTag string", () => {
    expect(readCustomTagNamesFromJson({ customTags: ["a1", "b2"], customTag: "c3" })).toEqual(["a1", "b2", "c3"]);
    expect(readCustomTagNamesFromJson({ customTags: "not-an-array" })).toEqual([]);
  });

  test("withDraft includes uncommitted text once", () => {
    expect(withDraft(["chill"], " gym ")).toEqual(["chill", "gym"]);
    expect(withDraft(["chill"], "Chill")).toEqual(["chill"]);
    expect(withDraft(["chill"], "")).toEqual(["chill"]);
  });
});
