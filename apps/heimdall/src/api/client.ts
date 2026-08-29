/// <reference types="vite/client" />

import type {
  DashboardSnapshot,
  DocCatalog,
  SearchResult,
  StoryDetail,
  TestCatalog,
  TestRunCapability,
  TestRunScope,
  TestRunSnapshot,
  UiCaseCatalog,
  UiRunSnapshot,
  UiTestRunCapability,
  UiTestRunSnapshot,
  UiTestRunStartBody,
  VitestRunSnapshot,
} from "../types/dashboard";
import { dashboardApiBase } from "@/lib/runtime-config";

export type {
  DashboardSnapshot,
  DeliverySlice,
  DocCatalog,
  DocRecord,
  EpicRecord,
  EpicStatus,
  ExternalGap,
  FeatureRecord,
  OpenQuestion,
  SearchResult,
  StoryDetail,
  StoryRecord,
  StoryStatus,
  TestCatalog,
  TestCaseRecord,
  TestFileRecord,
  TestLevel,
  TestRunCapability,
  TestRunPhase,
  TestRunScope,
  TestRunSnapshot,
  TestRunSummary,
  RunnableTestLevel,
  VitestRunSnapshot,
  VitestFileRunResult,
  VitestCaseRunResult,
  VitestRunOutcome,
  UiCaseCatalog,
  UiTestCase,
  UiScreenManifestSummary,
  UiRunSnapshot,
  UiCaseRunResult,
  UiRunOutcome,
  UiTestRunCapability,
  UiTestRunCredentials,
  UiTestRunPhase,
  UiTestRunScope,
  UiTestRunSnapshot,
  UiTestRunStartBody,
  UiTestRunSummary,
} from "../types/dashboard";

const API_BASE = dashboardApiBase();

export type HeimdallRuntimeResponse = {
  basePath: string;
  branding?: {
    subtitle?: string;
    defaultTheme?: "dark" | "light";
  };
  links?: unknown;
  pages?: {
    tests?: boolean;
    testLevels?: Array<"L1" | "L2" | "L3" | "L4" | "tooling" | "L5">;
  };
  uiStoragePrefix?: string;
  modules: Array<{ id: string; label: string }>;
};

const FETCH_TIMEOUT_MS = 30_000;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const contentType = res.headers.get("content-type") ?? "";

    if (!res.ok) {
      let detail = `API error ${res.status} for ${url}`;
      try {
        const errBody = (await res.json()) as { error?: string };
        if (errBody.error) detail = errBody.error;
      } catch {
        /* ignore */
      }
      throw new Error(detail);
    }

    if (!contentType.includes("application/json")) {
      const body = await res.text();
      throw new Error(`Expected JSON from ${url} but got ${contentType}. ` + `Is the dev server running? Preview: ${body.slice(0, 80)}`);
    }

    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Request timed out after ${FETCH_TIMEOUT_MS / 1000}s: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export function fetchRuntime(): Promise<HeimdallRuntimeResponse> {
  return fetchJson(`${API_BASE}/runtime`);
}

export function fetchDashboard(module?: string): Promise<DashboardSnapshot> {
  const query = module != null && module !== "" ? `?module=${encodeURIComponent(module)}` : "";
  return fetchJson(`${API_BASE}/dashboard${query}`);
}

export function fetchStoryDetail(storyId: string): Promise<StoryDetail> {
  return fetchJson(`${API_BASE}/stories/${encodeURIComponent(storyId)}`);
}

export function fetchDocCatalog(): Promise<DocCatalog> {
  return fetchJson(`${API_BASE}/docs`);
}

export function fetchDocContent(path: string): Promise<{ path: string; content: string }> {
  return fetchJson(`${API_BASE}/docs/content?path=${encodeURIComponent(path)}`);
}

export function searchDocs(query: string): Promise<{ query: string; results: SearchResult[] }> {
  return fetchJson(`${API_BASE}/docs/search?q=${encodeURIComponent(query)}`);
}

export function fetchTestCatalog(): Promise<TestCatalog> {
  return fetchJson(`${API_BASE}/tests`);
}

export function fetchTestRunCapability(): Promise<TestRunCapability> {
  return fetchJson(`${API_BASE}/tests/run`);
}

export function fetchVitestRunSnapshot(): Promise<VitestRunSnapshot> {
  return fetchJson(`${API_BASE}/vitest-runs`);
}

export function writeVitestRunSnapshot(body: Partial<VitestRunSnapshot>): Promise<{ ok: true; path: string; lastRun: VitestRunSnapshot }> {
  return fetchJson(`${API_BASE}/vitest-runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function startTestRun(body: TestRunScope): Promise<{ ok: true; run: TestRunSnapshot }> {
  return fetchJson(`${API_BASE}/tests/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function cancelTestRun(): Promise<{ ok: true; run: TestRunSnapshot | null }> {
  return fetchJson(`${API_BASE}/tests/run/cancel`, { method: "POST" });
}

export type TestRunStreamHandlers = {
  onSnapshot?: (run: TestRunSnapshot) => void;
  onLog?: (chunk: string) => void;
  onStatus?: (run: Partial<TestRunSnapshot> & { runId: string; status: TestRunSnapshot["status"] }) => void;
  onDone?: (payload: {
    runId: string;
    status: TestRunSnapshot["status"];
    exitCode: number | null;
    summary: TestRunSnapshot["summary"];
    finishedAt: string | null;
  }) => void;
  onIdle?: () => void;
  onError?: (err: Event) => void;
};

/** Subscribe to live Vitest run events (SSE). Returns an unsubscribe function. */
export function subscribeTestRunStream(handlers: TestRunStreamHandlers): () => void {
  const url = `${API_BASE}/tests/run/stream`;
  const source = new EventSource(url);

  source.addEventListener("snapshot", (ev) => {
    try {
      handlers.onSnapshot?.(JSON.parse((ev as MessageEvent).data) as TestRunSnapshot);
    } catch {
      /* ignore malformed */
    }
  });
  source.addEventListener("log", (ev) => {
    try {
      const data = JSON.parse((ev as MessageEvent).data) as { chunk?: string };
      if (data.chunk) handlers.onLog?.(data.chunk);
    } catch {
      /* ignore */
    }
  });
  source.addEventListener("status", (ev) => {
    try {
      handlers.onStatus?.(JSON.parse((ev as MessageEvent).data));
    } catch {
      /* ignore */
    }
  });
  source.addEventListener("done", (ev) => {
    try {
      handlers.onDone?.(JSON.parse((ev as MessageEvent).data));
    } catch {
      /* ignore */
    }
  });
  source.addEventListener("idle", () => {
    handlers.onIdle?.();
  });
  source.onerror = (err) => {
    handlers.onError?.(err);
  };

  return () => {
    source.close();
  };
}

export function fetchUiCaseCatalog(): Promise<UiCaseCatalog> {
  return fetchJson(`${API_BASE}/ui-cases`);
}

export function fetchUiTestRunCapability(): Promise<UiTestRunCapability> {
  return fetchJson(`${API_BASE}/ui-tests/run`);
}

export function fetchUiRunSnapshot(): Promise<UiRunSnapshot> {
  return fetchJson(`${API_BASE}/ui-runs`);
}

export function writeUiRunSnapshot(body: Partial<UiRunSnapshot>): Promise<{ ok: true; path: string; lastRun: UiRunSnapshot }> {
  return fetchJson(`${API_BASE}/ui-runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function startUiTestRun(body: UiTestRunStartBody): Promise<{ ok: true; run: UiTestRunSnapshot }> {
  return fetchJson(`${API_BASE}/ui-tests/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function cancelUiTestRun(): Promise<{ ok: true; run: UiTestRunSnapshot | null }> {
  return fetchJson(`${API_BASE}/ui-tests/run/cancel`, { method: "POST" });
}

export type UiTestRunStreamHandlers = {
  onSnapshot?: (run: UiTestRunSnapshot) => void;
  onLog?: (chunk: string) => void;
  onStatus?: (run: Partial<UiTestRunSnapshot> & { runId: string; status: UiTestRunSnapshot["status"] }) => void;
  onDone?: (payload: {
    runId: string;
    status: UiTestRunSnapshot["status"];
    exitCode: number | null;
    summary: UiTestRunSnapshot["summary"];
    finishedAt: string | null;
    playwrightReportAvailable?: boolean;
    playwrightReportUrl?: string | null;
  }) => void;
  onIdle?: () => void;
  onError?: (err: Event) => void;
};

/** Subscribe to live L5 Playwright run events (SSE). */
export function subscribeUiTestRunStream(handlers: UiTestRunStreamHandlers): () => void {
  const url = `${API_BASE}/ui-tests/run/stream`;
  const source = new EventSource(url);

  source.addEventListener("snapshot", (ev) => {
    try {
      handlers.onSnapshot?.(JSON.parse((ev as MessageEvent).data) as UiTestRunSnapshot);
    } catch {
      /* ignore malformed */
    }
  });
  source.addEventListener("log", (ev) => {
    try {
      const data = JSON.parse((ev as MessageEvent).data) as { chunk?: string };
      if (data.chunk) handlers.onLog?.(data.chunk);
    } catch {
      /* ignore */
    }
  });
  source.addEventListener("status", (ev) => {
    try {
      handlers.onStatus?.(JSON.parse((ev as MessageEvent).data));
    } catch {
      /* ignore */
    }
  });
  source.addEventListener("done", (ev) => {
    try {
      handlers.onDone?.(JSON.parse((ev as MessageEvent).data));
    } catch {
      /* ignore */
    }
  });
  source.addEventListener("idle", () => {
    handlers.onIdle?.();
  });
  source.onerror = (err) => {
    handlers.onError?.(err);
  };

  return () => {
    source.close();
  };
}

/** Vite HMR custom event when docs change (standalone `heimdall dev`). */
export function subscribeToReload(callback: () => void): () => void {
  const handler = () => callback();
  if (import.meta.hot) {
    import.meta.hot.on("dashboard:reload", handler);
    return () => {
      import.meta.hot?.off("dashboard:reload", handler);
    };
  }
  const onCustom = (event: Event) => {
    const detail = (event as CustomEvent).type;
    if (detail === "dashboard:reload") callback();
  };
  window.addEventListener("dashboard:reload", onCustom);
  return () => window.removeEventListener("dashboard:reload", onCustom);
}
