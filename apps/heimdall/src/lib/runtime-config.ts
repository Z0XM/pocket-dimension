import type { ConfigTestLevel } from "@/config/testLevels";
import { resolveEnabledTestLevels } from "@/config/testLevels";

export type HeimdallTheme = "dark" | "light";

export interface HeimdallRuntimeConfig {
  basePath: string;
  apiDocsPath: string | null;
  samplePath: string | null;
  dashboardApiBase: string;
  /** localStorage key prefix; default heimdall */
  uiStoragePrefix?: string;
  /** Config default when no stored theme preference (omit → dark). */
  defaultTheme?: HeimdallTheme;
  pages?: {
    tests?: boolean;
    /** When omitted, all levels are enabled. */
    testLevels?: ConfigTestLevel[];
  };
}

declare global {
  interface Window {
    __HEIMDALL_RUNTIME__?: HeimdallRuntimeConfig;
    /** @deprecated legacy SI inject — ignored by Heimdall */
    __SI_RUNTIME__?: unknown;
  }
}

function runtime(): HeimdallRuntimeConfig | undefined {
  if (typeof window === "undefined") return undefined;
  return window.__HEIMDALL_RUNTIME__;
}

/** Effective public base (e.g. /heimdall or /my-app/heimdall). */
export function docsBasePath(): string {
  const configured = runtime()?.basePath;
  if (configured != null && configured !== "") {
    return configured === "/" ? "" : configured.replace(/\/$/, "");
  }
  const viteBase = import.meta.env.BASE_URL.replace(/\/$/, "");
  return viteBase || "/heimdall";
}

export function apiDocsPath(): string | null {
  return runtime()?.apiDocsPath ?? null;
}

export function samplePath(): string | null {
  return runtime()?.samplePath ?? null;
}

export function pagesTestsEnabled(): boolean {
  if (runtime()?.pages?.tests === true) return true;
  // Standalone Vite inject sets this from config.pages.tests (heimdall dev).
  if (import.meta.env.VITE_HEIMDALL_PAGES_TESTS === "1") return true;
  return false;
}

/** Enabled Tests page levels (Vitest L1–L4/tooling + L5 UI). */
export function pagesTestLevels(): Set<ConfigTestLevel> {
  const fromRuntime = runtime()?.pages?.testLevels;
  if (fromRuntime != null) return resolveEnabledTestLevels(fromRuntime);
  const fromEnv = import.meta.env.VITE_HEIMDALL_TEST_LEVELS as string | undefined;
  if (fromEnv != null && fromEnv !== "") {
    const parsed = fromEnv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) as ConfigTestLevel[];
    return resolveEnabledTestLevels(parsed);
  }
  return resolveEnabledTestLevels(undefined);
}

export function dashboardApiBase(): string {
  if (runtime()?.dashboardApiBase) return runtime()!.dashboardApiBase;
  return import.meta.env.VITE_DASHBOARD_API_BASE ?? (import.meta.env.DEV ? "/api" : "/heimdall/dev-api");
}

/** Prefix for browser storage keys (`${prefix}-sidebar-collapsed`, …). */
export function uiStoragePrefix(): string {
  const fromRuntime = runtime()?.uiStoragePrefix?.trim();
  if (fromRuntime) return fromRuntime;
  const fromEnv = (import.meta.env.VITE_HEIMDALL_UI_STORAGE_PREFIX as string | undefined)?.trim();
  if (fromEnv) return fromEnv;
  return "heimdall";
}

export function uiStorageKey(suffix: string): string {
  return `${uiStoragePrefix()}-${suffix}`;
}

/** Config-owned default theme (stored preference wins at apply time). */
export function defaultTheme(): HeimdallTheme {
  const fromRuntime = runtime()?.defaultTheme;
  if (fromRuntime === "dark" || fromRuntime === "light") return fromRuntime;
  const fromEnv = import.meta.env.VITE_HEIMDALL_DEFAULT_THEME as string | undefined;
  if (fromEnv === "dark" || fromEnv === "light") return fromEnv;
  return "dark";
}
