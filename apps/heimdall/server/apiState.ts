import { normalizeApiPath } from "./apiPath.js";
import { indexDocs, readDocContent, buildSearchDocuments } from "./indexDocs.js";
import { loadDashboard, loadStoryDetail, normalizeDashboardScopeKey, runtimeModuleList } from "./loadDashboard.js";
import { loadTestCatalog, filterTestCatalogByLevels } from "./parseTestCatalog.js";
import { loadUiCaseCatalog } from "./parseUiCaseCatalog.js";
import {
  emptyUiRunSnapshot,
  loadUiRunSnapshot,
  mergeAndWriteUiRunSnapshot,
  mergeCatalogWithRuns,
  parseUiRunBody,
  type UiCaseCatalogWithRuns,
} from "./parseUiRunResults.js";
import {
  emptyVitestRunSnapshot,
  loadVitestRunSnapshot,
  mergeAndWriteVitestRunSnapshot,
  mergeTestCatalogWithRuns,
  parseVitestRunBody,
} from "./parseVitestRunResults.js";
import { getRunnerAdapter, runnersNotConfigured, unavailableUiCapability, unavailableVitestCapability, type SseSend } from "./runners.js";
import { DocSearchIndex } from "./searchIndex.js";
import type { DashboardSnapshot, DocCatalog } from "./types.js";
import type { UiRunSnapshot } from "../src/types/dashboard.js";
import { CONFIG_TEST_LEVELS, resolveEnabledTestLevels } from "../src/config/testLevels.js";
import { getEffectiveBasePath, getHeimdallConfig, getRepoRoot } from "./runtime.js";

let dashboardCache = new Map<string, DashboardSnapshot>();
let testCatalogCache: ReturnType<typeof loadTestCatalog> | null = null;
let uiCaseCatalogCache: ReturnType<typeof loadUiCaseCatalog> | null = null;
let uiRunSnapshotCache: UiRunSnapshot | null | undefined = undefined;
let docCatalogCache: DocCatalog | null = null;
let docsIndexReady = false;
let docsIndexPromise: Promise<void> | null = null;
const searchIndex = new DocSearchIndex();

export function rebuildDashboard(scope?: string): DashboardSnapshot {
  const config = getHeimdallConfig();
  const repoRoot = getRepoRoot();

  if (scope === undefined) {
    dashboardCache.clear();
    testCatalogCache = null;
    uiCaseCatalogCache = null;
    uiRunSnapshotCache = undefined;
    const key = normalizeDashboardScopeKey(undefined, config, repoRoot);
    const snap = loadDashboard(repoRoot, config);
    dashboardCache.set(key, snap);
    return snap;
  }

  const key = normalizeDashboardScopeKey(scope, config, repoRoot);
  const snap = loadDashboard(repoRoot, config, scope);
  dashboardCache.set(key, snap);
  return snap;
}

export function rebuildDocs(): DocCatalog {
  const config = getHeimdallConfig();
  docCatalogCache = indexDocs(getRepoRoot(), config);
  const searchDocs = buildSearchDocuments(getRepoRoot(), docCatalogCache, config);
  searchIndex.rebuild(searchDocs);
  docsIndexReady = true;
  return docCatalogCache;
}

async function ensureDocsIndex(): Promise<void> {
  if (docsIndexReady && docCatalogCache) return;
  if (!docsIndexPromise) {
    docsIndexPromise = Promise.resolve()
      .then(() => {
        rebuildDocs();
      })
      .catch((err) => {
        // Allow a later request to retry after a transient index failure.
        docsIndexPromise = null;
        docsIndexReady = false;
        throw err;
      });
  }
  await docsIndexPromise;
}

function getDashboard(moduleParam?: string | null): DashboardSnapshot {
  const config = getHeimdallConfig();
  const repoRoot = getRepoRoot();
  const key = normalizeDashboardScopeKey(moduleParam, config, repoRoot);
  const cached = dashboardCache.get(key);
  if (cached) return cached;
  const snap = loadDashboard(repoRoot, config, moduleParam ?? undefined);
  dashboardCache.set(key, snap);
  return snap;
}

function getTestCatalog() {
  if (!testCatalogCache) {
    const config = getHeimdallConfig();
    testCatalogCache = loadTestCatalog(getRepoRoot(), config.paths.testRoots);
  }
  return testCatalogCache;
}

function getUiCaseCatalog() {
  if (!uiCaseCatalogCache) {
    const config = getHeimdallConfig();
    uiCaseCatalogCache = loadUiCaseCatalog(getRepoRoot(), config.paths.uiExpectationsDir);
  }
  return uiCaseCatalogCache;
}

function getUiRunSnapshot(): UiRunSnapshot | null {
  if (uiRunSnapshotCache === undefined) {
    const config = getHeimdallConfig();
    uiRunSnapshotCache = loadUiRunSnapshot(getRepoRoot(), config.paths.uiRunsDir);
  }
  return uiRunSnapshotCache;
}

function getUiCaseCatalogWithRuns(): UiCaseCatalogWithRuns {
  return mergeCatalogWithRuns(getUiCaseCatalog(), getUiRunSnapshot());
}

export function preloadDashboard(): void {
  console.log("[api] Loading dashboard data…");
  rebuildDashboard();
  console.log("[api] Dashboard ready");
}

export function preloadDocsAsync(): void {
  void ensureDocsIndex()
    .then(() => console.log("[api] Docs index ready"))
    .catch((err) => console.error("[api] Docs index failed:", err));
}

export type { SseSend } from "./runners.js";

export type ApiRequestContext = Record<string, never>;

export type ApiResult =
  | { kind: "json"; status: number; body: unknown }
  | {
      kind: "file";
      status: number;
      filePath?: string;
      body?: string;
      contentType: string;
    }
  | { kind: "redirect"; status: 301 | 302 | 307 | 308; location: string }
  | {
      kind: "sse";
      status: number;
      attach: (send: SseSend) => () => void;
    };

function json(status: number, body: unknown): ApiResult {
  return { kind: "json", status, body };
}

function parseJsonBody(rawBody: string | undefined): { ok: true; value: unknown } | { ok: false; result: ApiResult } {
  try {
    return { ok: true, value: rawBody ? JSON.parse(rawBody) : null };
  } catch {
    return { ok: false, result: json(400, { error: "Invalid JSON body" }) };
  }
}

export async function handleApiRequest(
  pathname: string,
  method: string,
  searchParams: URLSearchParams,
  rawBody?: string,
  _context: ApiRequestContext = {}
): Promise<ApiResult> {
  const basePath = getEffectiveBasePath();
  const route = normalizeApiPath(pathname, basePath);

  if (route === "/health" && method === "GET") {
    return json(200, {
      ok: true,
      repoRoot: getRepoRoot(),
      basePath,
      hasDashboard: dashboardCache.size > 0,
      docsIndexReady,
    });
  }

  if (route === "/dashboard" && method === "GET") {
    const moduleParam = searchParams.get("module");
    return json(200, getDashboard(moduleParam));
  }

  if (route === "/dashboard/reload" && method === "POST") {
    rebuildDashboard();
    docsIndexReady = false;
    docsIndexPromise = null;
    await ensureDocsIndex();
    return json(200, { ok: true, generatedAt: new Date().toISOString() });
  }

  if (route.startsWith("/stories/") && method === "GET") {
    const storyId = decodeURIComponent(route.replace("/stories/", ""));
    const detail = loadStoryDetail(getRepoRoot(), storyId, getDashboard(), getHeimdallConfig());
    if (!detail) return json(404, { error: "Story not found" });
    return json(200, detail);
  }

  if (route === "/tests" && method === "GET") {
    const config = getHeimdallConfig();
    const enabled = resolveEnabledTestLevels(config.pages.testLevels);
    const filtered = filterTestCatalogByLevels(getTestCatalog(), enabled);
    const merged = mergeTestCatalogWithRuns(filtered, loadVitestRunSnapshot(getRepoRoot(), config.paths.vitestRunsDir));
    return json(200, {
      ...merged,
      /** Authoritative list for Tests page cards/filters (config `pages.testLevels`). */
      enabledLevels: CONFIG_TEST_LEVELS.filter((level) => enabled.has(level)),
    });
  }

  if (route === "/vitest-runs" && method === "GET") {
    const config = getHeimdallConfig();
    return json(200, loadVitestRunSnapshot(getRepoRoot(), config.paths.vitestRunsDir) ?? emptyVitestRunSnapshot());
  }

  if (route === "/vitest-runs" && method === "POST") {
    const parsed = parseJsonBody(rawBody);
    if (!parsed.ok) return parsed.result;
    let incoming;
    try {
      incoming = parseVitestRunBody(parsed.value);
    } catch (err) {
      return json(400, { error: String(err instanceof Error ? err.message : err) });
    }
    const config = getHeimdallConfig();
    const { path, snapshot } = mergeAndWriteVitestRunSnapshot(getRepoRoot(), incoming, {
      alsoDateCopy: true,
      runsDir: config.paths.vitestRunsDir,
    });
    return json(200, { ok: true, path, lastRun: snapshot });
  }

  if (route === "/tests/run" && method === "GET") {
    const adapter = getRunnerAdapter();
    return json(200, adapter ? await adapter.getVitestCapability() : unavailableVitestCapability());
  }

  if (route === "/tests/run" && method === "POST") {
    const adapter = getRunnerAdapter();
    if (!adapter) return json(runnersNotConfigured().status, runnersNotConfigured().body);
    const parsed = parseJsonBody(rawBody);
    if (!parsed.ok) return parsed.result;
    const result = await adapter.startVitest(parsed.value);
    return json(result.status, result.body);
  }

  if (route === "/tests/run/cancel" && method === "POST") {
    const adapter = getRunnerAdapter();
    if (!adapter) return json(runnersNotConfigured().status, runnersNotConfigured().body);
    const result = await adapter.cancelVitest();
    return json(result.status, result.body);
  }

  if (route === "/tests/run/stream" && method === "GET") {
    const adapter = getRunnerAdapter();
    if (!adapter?.attachVitestStream) return json(runnersNotConfigured().status, runnersNotConfigured().body);
    return { kind: "sse", status: 200, attach: adapter.attachVitestStream };
  }

  if (route === "/ui-cases" && method === "GET") {
    const config = getHeimdallConfig();
    const enabled = resolveEnabledTestLevels(config.pages.testLevels);
    if (!enabled.has("L5")) {
      return json(200, {
        cases: [],
        manifests: {},
        summary: { screenCount: 0, caseCount: 0, byStatus: {}, byPriority: {} },
        lastRun: null,
        generatedAt: new Date().toISOString(),
      });
    }
    const catalog = getUiCaseCatalogWithRuns();
    const screenId = searchParams.get("screenId");
    const priority = searchParams.get("priority");
    const id = searchParams.get("id");
    let cases = catalog.cases;
    if (screenId) cases = cases.filter((c) => c.screenId === screenId);
    if (priority) cases = cases.filter((c) => c.priority === priority);
    if (id) {
      const found = cases.find((c) => c.id === id);
      if (!found) return json(404, { error: `Unknown case ${id}` });
      return json(200, {
        case: found,
        manifest: catalog.manifests?.[found.screenId] ?? null,
        lastRun: catalog.lastRun,
      });
    }
    return json(200, {
      ...catalog,
      cases,
      summary: {
        ...catalog.summary,
        caseCount: cases.length,
      },
    });
  }

  if (route === "/ui-runs" && method === "GET") {
    return json(200, getUiRunSnapshot() ?? emptyUiRunSnapshot());
  }

  if (route === "/ui-runs" && method === "POST") {
    const parsed = parseJsonBody(rawBody);
    if (!parsed.ok) return parsed.result;
    let snapshot;
    try {
      snapshot = parseUiRunBody(parsed.value);
    } catch (err) {
      return json(400, { error: String(err instanceof Error ? err.message : err) });
    }
    const config = getHeimdallConfig();
    const { path: pathWritten, snapshot: merged } = mergeAndWriteUiRunSnapshot(getRepoRoot(), snapshot, {
      alsoDateCopy: true,
      runsDir: config.paths.uiRunsDir,
    });
    uiRunSnapshotCache = merged;
    return json(200, { ok: true, path: pathWritten, lastRun: merged });
  }

  if (route === "/ui-tests/run" && method === "GET") {
    const adapter = getRunnerAdapter();
    return json(200, adapter ? await adapter.getUiCapability() : unavailableUiCapability());
  }

  if (route === "/ui-tests/run" && method === "POST") {
    const adapter = getRunnerAdapter();
    if (!adapter) return json(runnersNotConfigured().status, runnersNotConfigured().body);
    const parsed = parseJsonBody(rawBody);
    if (!parsed.ok) return parsed.result;
    const result = await adapter.startUi(parsed.value);
    return json(result.status, result.body);
  }

  if (route === "/ui-tests/run/cancel" && method === "POST") {
    const adapter = getRunnerAdapter();
    if (!adapter) return json(runnersNotConfigured().status, runnersNotConfigured().body);
    const result = await adapter.cancelUi();
    return json(result.status, result.body);
  }

  if (route === "/ui-tests/run/stream" && method === "GET") {
    const adapter = getRunnerAdapter();
    if (!adapter?.attachUiStream) return json(runnersNotConfigured().status, runnersNotConfigured().body);
    return { kind: "sse", status: 200, attach: adapter.attachUiStream };
  }

  if (route.startsWith("/ui-tests/report") && method === "GET") {
    const adapter = getRunnerAdapter();
    if (!adapter) return json(runnersNotConfigured().status, runnersNotConfigured().body);
    const resolved = adapter.resolvePlaywrightReport?.(route) ?? null;
    if (!resolved) return json(404, { error: "Playwright report file not found" });
    if (resolved.kind === "redirect") {
      return { kind: "redirect", status: 302, location: resolved.location };
    }
    if (resolved.kind === "json") {
      return json(resolved.status, resolved.body);
    }
    return {
      kind: "file",
      status: 200,
      filePath: resolved.filePath,
      body: resolved.body,
      contentType: resolved.contentType,
    };
  }

  if (route === "/docs" && method === "GET") {
    await ensureDocsIndex();
    return json(200, docCatalogCache);
  }

  if (route === "/docs/search" && method === "GET") {
    await ensureDocsIndex();
    const q = searchParams.get("q") ?? "";
    return json(200, { query: q, results: searchIndex.search(q) });
  }

  if (route === "/docs/content" && method === "GET") {
    const docPath = searchParams.get("path");
    if (!docPath) return json(400, { error: "path required" });
    try {
      const content = readDocContent(getRepoRoot(), docPath, getHeimdallConfig());
      return json(200, { path: docPath, content });
    } catch (err) {
      return json(404, { error: String(err) });
    }
  }

  if (route === "/runtime" && method === "GET") {
    const config = getHeimdallConfig();
    return json(200, {
      basePath,
      branding: config.branding,
      links: config.links,
      pages: config.pages,
      uiStoragePrefix: config.runtime.uiStoragePrefix,
      modules: runtimeModuleList(config, getRepoRoot()),
    });
  }

  return json(404, { error: `Not found: ${route}` });
}
