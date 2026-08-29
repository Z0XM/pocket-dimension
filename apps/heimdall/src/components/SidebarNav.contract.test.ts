import { afterEach, describe, expect, it, vi } from "vitest";

describe("SidebarNav", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("keeps Tests out of nav when pages.tests is false", async () => {
    vi.stubEnv("VITE_HEIMDALL_PAGES_TESTS", "0");
    const { getNavItems } = await import("./SidebarNav");
    expect(getNavItems().map((item) => item.label)).not.toContain("Tests");
  });

  it("includes Tests when VITE_HEIMDALL_PAGES_TESTS=1", async () => {
    vi.stubEnv("VITE_HEIMDALL_PAGES_TESTS", "1");
    const { getNavItems } = await import("./SidebarNav");
    expect(getNavItems().map((item) => item.label)).toContain("Tests");
  });
});
