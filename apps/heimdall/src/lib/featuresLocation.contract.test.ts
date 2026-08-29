import { describe, expect, it } from "vitest";
import { featuresHref, featuresLocation, scopedHref } from "./featuresLocation";

describe("featuresLocation", () => {
  it("preserves module query when setting a feature hash", () => {
    expect(featuresLocation("F-3", "?module=heimdall")).toEqual({
      pathname: "/features",
      search: "?module=heimdall",
      hash: "#F-3",
    });
  });

  it("clears hash while keeping search when collapsing", () => {
    expect(featuresLocation(null, "?module=commons")).toEqual({
      pathname: "/features",
      search: "?module=commons",
      hash: "",
    });
  });

  it("strips leading # from feature id", () => {
    expect(featuresLocation("#F-1", "?module=all").hash).toBe("#F-1");
  });

  it("featuresHref serializes pathname + search + hash", () => {
    expect(featuresHref("F-2", "?module=heimdall")).toBe("/features?module=heimdall#F-2");
  });

  it("normalizes search without leading ?", () => {
    expect(featuresHref("F-1", "module=heimdall")).toBe("/features?module=heimdall#F-1");
  });

  it("scopedHref rebuilds features links with current search", () => {
    expect(scopedHref("/features#F-9", "?module=commons")).toBe("/features?module=commons#F-9");
    expect(scopedHref("/delivery", "?module=commons")).toBe("/delivery");
  });
});
