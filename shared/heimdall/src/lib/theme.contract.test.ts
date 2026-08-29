import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { uiStorageKey } from "@/lib/runtime-config";
import { applyDocumentTheme, isThemeValue, readStoredTheme, resolveTheme, setDocumentTheme, toggleDocumentTheme, writeStoredTheme } from "./theme";

describe("theme helpers", () => {
  it("isThemeValue accepts dark and light only", () => {
    expect(isThemeValue("dark")).toBe(true);
    expect(isThemeValue("light")).toBe(true);
    expect(isThemeValue("system")).toBe(false);
    expect(isThemeValue(null)).toBe(false);
  });

  it("resolveTheme prefers stored over default over dark", () => {
    expect(resolveTheme({ stored: "light", defaultTheme: "dark" })).toBe("light");
    expect(resolveTheme({ stored: null, defaultTheme: "light" })).toBe("light");
    expect(resolveTheme({ stored: null, defaultTheme: null })).toBe("dark");
  });

  it("resolveTheme ignores invalid stored values", () => {
    expect(resolveTheme({ stored: "auto", defaultTheme: "light" })).toBe("light");
    expect(resolveTheme({ stored: "", defaultTheme: undefined })).toBe("dark");
  });

  it("readStoredTheme returns null for invalid or missing values", () => {
    const getItem = vi.fn().mockReturnValue(null);
    vi.stubGlobal("localStorage", { getItem });
    expect(readStoredTheme()).toBeNull();
    getItem.mockReturnValue("system");
    expect(readStoredTheme()).toBeNull();
    getItem.mockReturnValue("light");
    expect(readStoredTheme()).toBe("light");
    vi.unstubAllGlobals();
  });

  it("applyDocumentTheme sets data-theme and color-scheme on documentElement", () => {
    const root = {
      dataset: {} as DOMStringMap,
      style: { colorScheme: "" } as CSSStyleDeclaration,
    };
    vi.stubGlobal("document", { documentElement: root });
    applyDocumentTheme("light");
    expect(root.dataset.theme).toBe("light");
    expect(root.style.colorScheme).toBe("light");
    vi.unstubAllGlobals();
  });

  it("writeStoredTheme persists under uiStorageKey theme", () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { getItem: vi.fn(), setItem });
    writeStoredTheme("light");
    expect(setItem).toHaveBeenCalledWith(uiStorageKey("theme"), "light");
    vi.unstubAllGlobals();
  });

  it("setDocumentTheme writes storage and applies data-theme", () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { getItem: vi.fn(), setItem });
    const root = {
      dataset: {} as DOMStringMap,
      style: { colorScheme: "" } as CSSStyleDeclaration,
    };
    vi.stubGlobal("document", { documentElement: root });
    setDocumentTheme("light");
    expect(setItem).toHaveBeenCalledWith(uiStorageKey("theme"), "light");
    expect(root.dataset.theme).toBe("light");
    expect(root.style.colorScheme).toBe("light");
    vi.unstubAllGlobals();
  });

  it("toggleDocumentTheme flips theme and persists", () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { getItem: vi.fn(), setItem });
    const root = {
      dataset: {} as DOMStringMap,
      style: { colorScheme: "" } as CSSStyleDeclaration,
    };
    vi.stubGlobal("document", { documentElement: root });
    expect(toggleDocumentTheme("dark")).toBe("light");
    expect(setItem).toHaveBeenCalledWith(uiStorageKey("theme"), "light");
    expect(root.dataset.theme).toBe("light");
    vi.unstubAllGlobals();
  });

  it("does not use prefers-color-scheme or matchMedia listeners", () => {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const themeFiles = ["theme.ts", "../hooks/useTheme.ts"].map((rel) => path.join(dir, rel));
    for (const file of themeFiles) {
      const source = readFileSync(file, "utf-8");
      expect(source).not.toMatch(/prefers-color-scheme/);
      expect(source).not.toMatch(/matchMedia/);
    }
  });
});

describe("light theme CSS tokens", () => {
  const stylesPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../styles.css");
  const stylesSource = readFileSync(stylesPath, "utf-8");

  const requiredLightSemanticVars = [
    "--background",
    "--foreground",
    "--card",
    "--card-foreground",
    "--popover",
    "--popover-foreground",
    "--primary",
    "--primary-foreground",
    "--secondary",
    "--secondary-foreground",
    "--muted",
    "--muted-foreground",
    "--accent",
    "--accent-foreground",
    "--destructive",
    "--destructive-foreground",
    "--border",
    "--input",
    "--ring",
    "--heading",
    "--scrollbar-thumb",
    "--radius",
  ] as const;

  it('defines [data-theme="light"] with color-scheme light', () => {
    expect(stylesSource).toMatch(/\[data-theme="light"\]\s*\{/);
    const lightBlock = stylesSource.match(/\[data-theme="light"\]\s*\{([^}]+)\}/s)?.[1];
    expect(lightBlock).toBeDefined();
    expect(lightBlock).toMatch(/color-scheme:\s*light/);
  });

  it("mirrors required semantic custom properties under light theme", () => {
    const lightBlock = stylesSource.match(/\[data-theme="light"\]\s*\{([^}]+)\}/s)?.[1];
    expect(lightBlock).toBeDefined();
    for (const varName of requiredLightSemanticVars) {
      expect(lightBlock).toContain(`${varName}:`);
    }
  });

  it("keeps dark baseline on :root with color-scheme dark", () => {
    const rootBlock = stylesSource.match(/:root\s*\{([^}]+)\}/s)?.[1];
    expect(rootBlock).toBeDefined();
    expect(rootBlock).toMatch(/color-scheme:\s*dark/);
    for (const varName of requiredLightSemanticVars) {
      expect(rootBlock).toContain(`${varName}:`);
    }
  });
});
