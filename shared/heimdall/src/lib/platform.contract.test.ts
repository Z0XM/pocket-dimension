import { afterEach, describe, expect, it, vi } from "vitest";
import { isApplePlatform, searchShortcutLabel } from "./platform";

function mockNavigator(platform: string | undefined): void {
  vi.stubGlobal("navigator", {
    platform,
    userAgentData: platform ? { platform } : undefined,
  });
}

describe("isApplePlatform", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true for Mac platform", () => {
    mockNavigator("MacIntel");
    expect(isApplePlatform()).toBe(true);
  });

  it("returns true for iPhone platform", () => {
    mockNavigator("iPhone");
    expect(isApplePlatform()).toBe(true);
  });

  it("returns false for Windows platform", () => {
    mockNavigator("Win32");
    expect(isApplePlatform()).toBe(false);
  });

  it("returns false when navigator is absent (SSR soft-default)", () => {
    vi.stubGlobal("navigator", undefined);
    expect(isApplePlatform()).toBe(false);
  });
});

describe("searchShortcutLabel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ⌘K on Apple platforms", () => {
    mockNavigator("MacIntel");
    expect(searchShortcutLabel()).toBe("⌘K");
  });

  it("returns Ctrl+K on non-Apple platforms", () => {
    mockNavigator("Win32");
    expect(searchShortcutLabel()).toBe("Ctrl+K");
  });

  it("returns Ctrl+K when navigator is absent (SSR soft-default)", () => {
    vi.stubGlobal("navigator", undefined);
    expect(searchShortcutLabel()).toBe("Ctrl+K");
  });
});
