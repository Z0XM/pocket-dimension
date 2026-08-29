import { describe, expect, it } from "vitest";
import type { FeatureStatusFilter } from "@/lib/featureStatus";
import {
  applyFeatureFilterParams,
  FEATURE_SEARCH_PARAM,
  FEATURE_STATUS_PARAM,
  parseFeatureSearchParam,
  parseFeatureStatusParam,
} from "./featuresFilterParams";

const FEATURE_STATUS_VALUES = [
  "all",
  "complete",
  "in-progress",
  "blocked",
  "confirmed",
  "pending",
  "deferred",
] as const satisfies readonly FeatureStatusFilter[];

describe("featuresFilterParams", () => {
  describe("parseFeatureStatusParam", () => {
    it("returns all for null, empty, or unknown values", () => {
      expect(parseFeatureStatusParam(null)).toBe("all");
      expect(parseFeatureStatusParam("")).toBe("all");
      expect(parseFeatureStatusParam("bogus")).toBe("all");
    });

    it("soft-defaults Delivery-only status ids without throw", () => {
      expect(parseFeatureStatusParam("ready-for-dev")).toBe("all");
      expect(parseFeatureStatusParam("backlog")).toBe("all");
      expect(parseFeatureStatusParam("review")).toBe("all");
      expect(parseFeatureStatusParam("done")).toBe("all");
    });

    it.each(FEATURE_STATUS_VALUES)("whitelists status %s", (status) => {
      expect(parseFeatureStatusParam(status)).toBe(status);
    });
  });

  describe("parseFeatureSearchParam", () => {
    it("returns empty string for null", () => {
      expect(parseFeatureSearchParam(null)).toBe("");
    });

    it("returns raw value when present", () => {
      expect(parseFeatureSearchParam("foo")).toBe("foo");
    });
  });

  describe("applyFeatureFilterParams", () => {
    it("sets status and q while preserving module", () => {
      const base = new URLSearchParams("module=heimdall");
      const out = applyFeatureFilterParams(base, {
        status: "blocked",
        q: "auth",
      });
      expect(out.get("module")).toBe("heimdall");
      expect(out.get(FEATURE_STATUS_PARAM)).toBe("blocked");
      expect(out.get(FEATURE_SEARCH_PARAM)).toBe("auth");
    });

    it("omits status when all and q when empty", () => {
      const base = new URLSearchParams("module=all&status=blocked&q=foo");
      const out = applyFeatureFilterParams(base, { status: "all", q: "   " });
      expect(out.get("module")).toBe("all");
      expect(out.has(FEATURE_STATUS_PARAM)).toBe(false);
      expect(out.has(FEATURE_SEARCH_PARAM)).toBe(false);
    });

    it("updates only the provided keys", () => {
      const base = new URLSearchParams("module=commons&status=pending&q=bar");
      const statusOnly = applyFeatureFilterParams(base, { status: "complete" });
      expect(statusOnly.get("module")).toBe("commons");
      expect(statusOnly.get(FEATURE_STATUS_PARAM)).toBe("complete");
      expect(statusOnly.get(FEATURE_SEARCH_PARAM)).toBe("bar");

      const qOnly = applyFeatureFilterParams(base, { q: "baz" });
      expect(qOnly.get(FEATURE_STATUS_PARAM)).toBe("pending");
      expect(qOnly.get(FEATURE_SEARCH_PARAM)).toBe("baz");
    });

    it("preserves unrelated sibling keys such as view", () => {
      const base = new URLSearchParams("module=heimdall&view=table");
      const out = applyFeatureFilterParams(base, { status: "blocked", q: "auth" });
      expect(out.get("module")).toBe("heimdall");
      expect(out.get("view")).toBe("table");
    });
  });

  describe("round-trip", () => {
    it.each(FEATURE_STATUS_VALUES)("round-trips status %s with module and q preserved", (status) => {
      const base = new URLSearchParams("module=heimdall&view=table");
      const applied = applyFeatureFilterParams(base, { status, q: "auth" });
      expect(applied.get("module")).toBe("heimdall");
      expect(applied.get("view")).toBe("table");
      expect(parseFeatureStatusParam(applied.get(FEATURE_STATUS_PARAM))).toBe(status);
      expect(parseFeatureSearchParam(applied.get(FEATURE_SEARCH_PARAM))).toBe("auth");
      if (status === "all") {
        expect(applied.has(FEATURE_STATUS_PARAM)).toBe(false);
      } else {
        expect(applied.get(FEATURE_STATUS_PARAM)).toBe(status);
      }
    });

    it("omits status and q keys for defaults then parse soft-defaults", () => {
      const base = new URLSearchParams("module=heimdall&status=blocked&q=foo");
      const applied = applyFeatureFilterParams(base, { status: "all", q: "" });
      expect(applied.has(FEATURE_STATUS_PARAM)).toBe(false);
      expect(applied.has(FEATURE_SEARCH_PARAM)).toBe(false);
      expect(parseFeatureStatusParam(applied.get(FEATURE_STATUS_PARAM))).toBe("all");
      expect(parseFeatureSearchParam(applied.get(FEATURE_SEARCH_PARAM))).toBe("");
    });

    it("round-trips non-empty search query", () => {
      const base = new URLSearchParams("module=heimdall");
      const applied = applyFeatureFilterParams(base, { q: "auth" });
      expect(applied.get(FEATURE_SEARCH_PARAM)).toBe("auth");
      expect(parseFeatureSearchParam(applied.get(FEATURE_SEARCH_PARAM))).toBe("auth");
    });

    it("deletes q for whitespace-only apply and parse returns empty", () => {
      const base = new URLSearchParams("module=heimdall&q=foo");
      const applied = applyFeatureFilterParams(base, { q: "   " });
      expect(applied.has(FEATURE_SEARCH_PARAM)).toBe(false);
      expect(parseFeatureSearchParam(applied.get(FEATURE_SEARCH_PARAM))).toBe("");
    });
  });
});
