import { describe, expect, it } from "vitest";
import {
  applyDeliveryFilterParams,
  DELIVERY_SEARCH_PARAM,
  DELIVERY_STATUS_PARAM,
  DELIVERY_VIEW_PARAM,
  parseDeliverySearchParam,
  parseDeliveryStatusParam,
  parseDeliveryViewParam,
  type DeliveryStatusFilter,
  type DeliveryView,
} from "./deliveryFilterParams";

const DELIVERY_STATUS_VALUES = [
  "all",
  "backlog",
  "ready-for-dev",
  "in-progress",
  "review",
  "blocked",
  "done",
] as const satisfies readonly DeliveryStatusFilter[];

const DELIVERY_VIEW_VALUES = ["kanban", "table", "timeline"] as const satisfies readonly DeliveryView[];

function applyDeliveryViewParam(params: URLSearchParams, view: DeliveryView): URLSearchParams {
  const out = new URLSearchParams(params);
  if (view === "kanban") out.delete(DELIVERY_VIEW_PARAM);
  else out.set(DELIVERY_VIEW_PARAM, view);
  return out;
}

describe("deliveryFilterParams", () => {
  describe("parseDeliveryStatusParam", () => {
    it("returns all for null, empty, or unknown values", () => {
      expect(parseDeliveryStatusParam(null)).toBe("all");
      expect(parseDeliveryStatusParam("")).toBe("all");
      expect(parseDeliveryStatusParam("bogus")).toBe("all");
    });

    it("soft-defaults Features-only status ids without throw", () => {
      expect(parseDeliveryStatusParam("complete")).toBe("all");
      expect(parseDeliveryStatusParam("deferred")).toBe("all");
      expect(parseDeliveryStatusParam("confirmed")).toBe("all");
      expect(parseDeliveryStatusParam("pending")).toBe("all");
    });

    it.each(DELIVERY_STATUS_VALUES)("whitelists status %s", (status) => {
      expect(parseDeliveryStatusParam(status)).toBe(status);
    });
  });

  describe("parseDeliverySearchParam", () => {
    it("returns empty string for null", () => {
      expect(parseDeliverySearchParam(null)).toBe("");
    });

    it("returns raw value when present", () => {
      expect(parseDeliverySearchParam("foo")).toBe("foo");
    });
  });

  describe("parseDeliveryViewParam", () => {
    it("returns kanban for null, empty, or unknown values", () => {
      expect(parseDeliveryViewParam(null)).toBe("kanban");
      expect(parseDeliveryViewParam("")).toBe("kanban");
      expect(parseDeliveryViewParam("bogus")).toBe("kanban");
    });

    it.each(DELIVERY_VIEW_VALUES)("whitelists view %s", (view) => {
      expect(parseDeliveryViewParam(view)).toBe(view);
    });
  });

  describe("applyDeliveryFilterParams", () => {
    it("sets status and q while preserving module and view", () => {
      const base = new URLSearchParams("module=heimdall&view=table");
      const out = applyDeliveryFilterParams(base, {
        status: "blocked",
        q: "auth",
      });
      expect(out.get("module")).toBe("heimdall");
      expect(out.get(DELIVERY_VIEW_PARAM)).toBe("table");
      expect(out.get(DELIVERY_STATUS_PARAM)).toBe("blocked");
      expect(out.get(DELIVERY_SEARCH_PARAM)).toBe("auth");
    });

    it("omits status when all and q when empty", () => {
      const base = new URLSearchParams("module=all&view=timeline&status=blocked&q=foo");
      const out = applyDeliveryFilterParams(base, { status: "all", q: "   " });
      expect(out.get("module")).toBe("all");
      expect(out.get(DELIVERY_VIEW_PARAM)).toBe("timeline");
      expect(out.has(DELIVERY_STATUS_PARAM)).toBe(false);
      expect(out.has(DELIVERY_SEARCH_PARAM)).toBe(false);
    });

    it("updates only the provided keys", () => {
      const base = new URLSearchParams("module=commons&view=table&status=blocked&q=bar");
      const statusOnly = applyDeliveryFilterParams(base, { status: "in-progress" });
      expect(statusOnly.get("module")).toBe("commons");
      expect(statusOnly.get(DELIVERY_VIEW_PARAM)).toBe("table");
      expect(statusOnly.get(DELIVERY_STATUS_PARAM)).toBe("in-progress");
      expect(statusOnly.get(DELIVERY_SEARCH_PARAM)).toBe("bar");

      const qOnly = applyDeliveryFilterParams(base, { q: "baz" });
      expect(qOnly.get(DELIVERY_STATUS_PARAM)).toBe("blocked");
      expect(qOnly.get(DELIVERY_SEARCH_PARAM)).toBe("baz");
    });
  });

  describe("round-trip", () => {
    it.each(DELIVERY_STATUS_VALUES)("round-trips status %s with module, view, and q preserved", (status) => {
      const base = new URLSearchParams("module=heimdall&view=table");
      const applied = applyDeliveryFilterParams(base, { status, q: "auth" });
      expect(applied.get("module")).toBe("heimdall");
      expect(applied.get(DELIVERY_VIEW_PARAM)).toBe("table");
      expect(parseDeliveryStatusParam(applied.get(DELIVERY_STATUS_PARAM))).toBe(status);
      expect(parseDeliverySearchParam(applied.get(DELIVERY_SEARCH_PARAM))).toBe("auth");
      if (status === "all") {
        expect(applied.has(DELIVERY_STATUS_PARAM)).toBe(false);
      } else {
        expect(applied.get(DELIVERY_STATUS_PARAM)).toBe(status);
      }
    });

    it.each(DELIVERY_STATUS_VALUES)("round-trips status %s with timeline view", (status) => {
      const base = new URLSearchParams("module=commons&view=timeline");
      const applied = applyDeliveryFilterParams(base, { status, q: "sprint" });
      expect(applied.get("module")).toBe("commons");
      expect(applied.get(DELIVERY_VIEW_PARAM)).toBe("timeline");
      expect(parseDeliveryStatusParam(applied.get(DELIVERY_STATUS_PARAM))).toBe(status);
      expect(parseDeliverySearchParam(applied.get(DELIVERY_SEARCH_PARAM))).toBe("sprint");
    });

    it("omits status and q keys for defaults then parse soft-defaults", () => {
      const base = new URLSearchParams("module=heimdall&view=table&status=blocked&q=foo");
      const applied = applyDeliveryFilterParams(base, { status: "all", q: "" });
      expect(applied.has(DELIVERY_STATUS_PARAM)).toBe(false);
      expect(applied.has(DELIVERY_SEARCH_PARAM)).toBe(false);
      expect(parseDeliveryStatusParam(applied.get(DELIVERY_STATUS_PARAM))).toBe("all");
      expect(parseDeliverySearchParam(applied.get(DELIVERY_SEARCH_PARAM))).toBe("");
    });

    it("round-trips non-empty search query", () => {
      const base = new URLSearchParams("module=heimdall&view=table");
      const applied = applyDeliveryFilterParams(base, { q: "auth" });
      expect(applied.get(DELIVERY_SEARCH_PARAM)).toBe("auth");
      expect(parseDeliverySearchParam(applied.get(DELIVERY_SEARCH_PARAM))).toBe("auth");
    });

    it("deletes q for whitespace-only apply and parse returns empty", () => {
      const base = new URLSearchParams("module=heimdall&view=table&q=foo");
      const applied = applyDeliveryFilterParams(base, { q: "   " });
      expect(applied.has(DELIVERY_SEARCH_PARAM)).toBe(false);
      expect(parseDeliverySearchParam(applied.get(DELIVERY_SEARCH_PARAM))).toBe("");
    });

    it.each(["table", "timeline"] as const)("round-trips view %s with filter params preserved", (view) => {
      const base = new URLSearchParams("module=heimdall&status=blocked&q=auth");
      const withView = applyDeliveryViewParam(base, view);
      const applied = applyDeliveryFilterParams(withView, { status: "in-progress" });
      expect(applied.get("module")).toBe("heimdall");
      expect(parseDeliveryViewParam(applied.get(DELIVERY_VIEW_PARAM))).toBe(view);
      expect(parseDeliveryStatusParam(applied.get(DELIVERY_STATUS_PARAM))).toBe("in-progress");
      expect(parseDeliverySearchParam(applied.get(DELIVERY_SEARCH_PARAM))).toBe("auth");
    });

    it("round-trips kanban by omitting view param", () => {
      const base = new URLSearchParams("module=heimdall&view=table&status=blocked&q=auth");
      const withKanban = applyDeliveryViewParam(base, "kanban");
      expect(withKanban.has(DELIVERY_VIEW_PARAM)).toBe(false);
      expect(parseDeliveryViewParam(withKanban.get(DELIVERY_VIEW_PARAM))).toBe("kanban");
      const applied = applyDeliveryFilterParams(withKanban, { status: "review" });
      expect(applied.has(DELIVERY_VIEW_PARAM)).toBe(false);
      expect(parseDeliveryViewParam(applied.get(DELIVERY_VIEW_PARAM))).toBe("kanban");
      expect(parseDeliveryStatusParam(applied.get(DELIVERY_STATUS_PARAM))).toBe("review");
    });
  });
});
