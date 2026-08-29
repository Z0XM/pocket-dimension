import { describe, expect, it } from "vitest";
import { dashboardModuleQueryArg, resolveClientModuleScope, shouldShowModuleScopeControl, type RuntimeModule } from "./moduleScope";

const MULTI: RuntimeModule[] = [
  { id: "divinity", label: "Divinity" },
  { id: "commons", label: "Commons" },
];

describe("moduleScope UI helpers", () => {
  it("shouldShowModuleScopeControl hides when length <= 1", () => {
    expect(shouldShowModuleScopeControl([])).toBe(false);
    expect(shouldShowModuleScopeControl([{ id: "default", label: "Default" }])).toBe(false);
  });

  it("shouldShowModuleScopeControl shows when length > 1", () => {
    expect(shouldShowModuleScopeControl(MULTI)).toBe(true);
  });

  it("resolveClientModuleScope defaults to all for multi with missing query", () => {
    expect(resolveClientModuleScope(undefined, MULTI)).toBe("all");
    expect(resolveClientModuleScope("", MULTI)).toBe("all");
    expect(resolveClientModuleScope(null, MULTI)).toBe("all");
  });

  it("resolveClientModuleScope returns known Enabled id", () => {
    expect(resolveClientModuleScope("divinity", MULTI)).toBe("divinity");
  });

  it("resolveClientModuleScope retains all when multi", () => {
    expect(resolveClientModuleScope("all", MULTI)).toBe("all");
  });

  it("resolveClientModuleScope falls back to first Enabled for unknown id", () => {
    expect(resolveClientModuleScope("nope", MULTI)).toBe("divinity");
  });

  it("resolveClientModuleScope uses sole Module id when length <= 1", () => {
    const sole = [{ id: "default", label: "Packages" }];
    expect(resolveClientModuleScope(undefined, sole)).toBe("default");
    expect(resolveClientModuleScope("all", sole)).toBe("default");
    expect(resolveClientModuleScope("unknown", sole)).toBe("default");
  });

  it("dashboardModuleQueryArg passes scope for multi and sole id for single", () => {
    expect(dashboardModuleQueryArg("all", MULTI)).toBe("all");
    expect(dashboardModuleQueryArg("commons", MULTI)).toBe("commons");
    expect(dashboardModuleQueryArg("all", [{ id: "default", label: "Default" }])).toBe("default");
  });
});
