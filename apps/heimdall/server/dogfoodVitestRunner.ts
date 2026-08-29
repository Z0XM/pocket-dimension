import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { resolveEnabledTestLevels } from "../src/config/testLevels.js";
import { loadTestCatalog } from "./parseTestCatalog.js";
import { mergeAndWriteVitestRunSnapshot, vitestCaseKey } from "./parseVitestRunResults.js";
import { runnersNotConfigured, unavailableUiCapability, type RunnerAdapter, type SseSend } from "./runners.js";
import { getHeimdallConfig, getRepoRoot } from "./runtime.js";
import type {
  TestRunCapability,
  TestRunScope,
  TestRunSnapshot,
  VitestCaseRunResult,
  VitestFileRunResult,
  VitestRunOutcome,
  VitestRunSnapshot,
} from "./types.js";

type SseListener = SseSend;

type PackageBatch = {
  packageDir: string;
  /** Paths relative to packageDir for vitest CLI */
  packageRelPaths: string[];
  /** Repo-relative paths (catalog keys) */
  repoRelPaths: string[];
};

export type DogfoodVitestRunnerOptions = {
  /** Test double for spawn — defaults to node:child_process.spawn */
  spawnFn?: typeof spawn;
  getRepoRoot?: () => string;
  getConfig?: () => ReturnType<typeof getHeimdallConfig>;
  loadCatalog?: typeof loadTestCatalog;
};

function normalizeRel(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "");
}

/** First path segment is the package folder under the monorepo root. */
export function packageRootForTestPath(repoRelPath: string): string | null {
  const norm = normalizeRel(repoRelPath);
  if (!norm || norm.startsWith("..") || norm.split("/").includes("..")) return null;
  const seg = norm.split("/")[0];
  if (!seg || seg === "." || seg === "..") return null;
  return seg;
}

export function parseTestRunScope(body: unknown): TestRunScope | { error: string } {
  if (!body || typeof body !== "object") return { error: "Body must be a JSON object" };
  const raw = body as Record<string, unknown>;
  if (raw.scope === "level") {
    if (raw.level !== "L1" && raw.level !== "L2") {
      return { error: 'level must be "L1" or "L2"' };
    }
    return { scope: "level", level: raw.level };
  }
  if (raw.scope === "file") {
    if (typeof raw.path !== "string" || !raw.path.trim()) {
      return { error: "path is required for scope=file" };
    }
    const pathNorm = normalizeRel(raw.path);
    if (pathNorm.startsWith("..") || pathNorm.split("/").includes("..")) {
      return { error: "path must stay within the repo" };
    }
    return { scope: "file", path: pathNorm };
  }
  if (raw.scope === "files") {
    if (!Array.isArray(raw.paths) || raw.paths.length === 0) {
      return { error: "paths must be a non-empty array for scope=files" };
    }
    const paths = raw.paths.map((p) => normalizeRel(String(p)));
    if (paths.some((p) => p.startsWith("..") || p.split("/").includes(".."))) {
      return { error: "paths must stay within the repo" };
    }
    return { scope: "files", paths };
  }
  return { error: 'scope must be "level", "file", or "files"' };
}

export function resolveScopedPaths(catalogPaths: readonly { path: string; level: string }[], scope: TestRunScope): string[] | { error: string } {
  if (scope.scope === "file") {
    const hit = catalogPaths.find((f) => f.path === scope.path);
    if (!hit) return { error: `Unknown test file: ${scope.path}` };
    return [hit.path];
  }
  if (scope.scope === "files") {
    const missing = scope.paths.filter((p) => !catalogPaths.some((f) => f.path === p));
    if (missing.length) return { error: `Unknown test file(s): ${missing.join(", ")}` };
    return [...scope.paths];
  }
  const levelPaths = catalogPaths.filter((f) => f.level === scope.level).map((f) => f.path);
  if (levelPaths.length === 0) return { error: `No ${scope.level} tests in catalog` };
  return levelPaths;
}

export function groupPathsByPackage(repoRelPaths: readonly string[]): PackageBatch[] {
  const byPkg = new Map<string, PackageBatch>();
  for (const repoRel of repoRelPaths) {
    const pkg = packageRootForTestPath(repoRel);
    if (!pkg) continue;
    const prefix = `${pkg}/`;
    const norm = normalizeRel(repoRel);
    if (!norm.startsWith(prefix)) continue;
    const packageRel = norm.slice(prefix.length);
    if (!packageRel || packageRel.split("/").includes("..")) continue;
    let batch = byPkg.get(pkg);
    if (!batch) {
      batch = { packageDir: pkg, packageRelPaths: [], repoRelPaths: [] };
      byPkg.set(pkg, batch);
    }
    batch.packageRelPaths.push(packageRel);
    batch.repoRelPaths.push(norm);
  }
  return [...byPkg.values()].sort((a, b) => a.packageDir.localeCompare(b.packageDir));
}

function mapVitestStatus(status: string | undefined): VitestRunOutcome {
  if (status === "passed" || status === "pass") return "passed";
  if (status === "failed" || status === "fail") return "failed";
  return "skipped";
}

/** Parse Vitest JSON reporter output into a Heimdall overlay snapshot. */
export function vitestJsonToOverlay(jsonText: string, repoRoot: string, meta: { command: string; runAt: string }): VitestRunSnapshot {
  const root = path.resolve(repoRoot);
  let parsed: {
    numPassedTests?: number;
    numFailedTests?: number;
    numPendingTests?: number;
    testResults?: Array<{
      name?: string;
      status?: string;
      assertionResults?: Array<{
        title?: string;
        fullName?: string;
        status?: string;
        ancestorTitles?: string[];
        duration?: number;
        failureMessages?: string[];
      }>;
    }>;
  };
  try {
    parsed = JSON.parse(jsonText) as typeof parsed;
  } catch {
    return {
      schemaVersion: 1,
      runAt: meta.runAt,
      source: "heimdall-dogfood",
      command: meta.command,
      summary: { passed: 0, failed: 0, skipped: 0 },
      files: {},
      cases: {},
    };
  }

  const files: Record<string, VitestFileRunResult> = {};
  const cases: Record<string, VitestCaseRunResult> = {};
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const result of parsed.testResults ?? []) {
    const abs = result.name ?? "";
    let repoRel = normalizeRel(abs);
    if (path.isAbsolute(abs)) {
      const rel = path.relative(root, abs);
      if (rel.startsWith("..") || path.isAbsolute(rel)) continue;
      repoRel = normalizeRel(rel);
    }
    if (!repoRel || repoRel.split("/").includes("..")) continue;
    let filePassed = 0;
    let fileFailed = 0;
    let fileSkipped = 0;
    for (const assertion of result.assertionResults ?? []) {
      const outcome = mapVitestStatus(assertion.status);
      if (outcome === "passed") {
        filePassed += 1;
        passed += 1;
      } else if (outcome === "failed") {
        fileFailed += 1;
        failed += 1;
      } else {
        fileSkipped += 1;
        skipped += 1;
      }
      const suitePath = assertion.ancestorTitles ?? [];
      const name = assertion.title ?? assertion.fullName ?? "unnamed";
      const key = vitestCaseKey(repoRel, suitePath, name);
      cases[key] = {
        outcome,
        ...(typeof assertion.duration === "number" ? { durationMs: assertion.duration } : {}),
        ...(assertion.failureMessages?.length ? { error: assertion.failureMessages.join("\n") } : {}),
      };
    }
    files[repoRel] = {
      outcome: fileFailed > 0 ? "failed" : filePassed > 0 ? "passed" : "skipped",
      passed: filePassed,
      failed: fileFailed,
      skipped: fileSkipped,
    };
  }

  if (Object.keys(files).length === 0) {
    passed = parsed.numPassedTests ?? 0;
    failed = parsed.numFailedTests ?? 0;
    skipped = parsed.numPendingTests ?? 0;
  }

  return {
    schemaVersion: 1,
    runAt: meta.runAt,
    source: "heimdall-dogfood",
    command: meta.command,
    summary: { passed, failed, skipped },
    files,
    cases,
  };
}

function packageHasVitest(repoRoot: string, packageDir: string): boolean {
  const abs = path.join(repoRoot, packageDir);
  const pkgJsonPath = path.join(abs, "package.json");
  if (!existsSync(pkgJsonPath)) return false;
  try {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    if (pkg.devDependencies?.vitest || pkg.dependencies?.vitest) return true;
  } catch {
    /* fall through to config files */
  }
  return (
    existsSync(path.join(abs, "vitest.config.ts")) ||
    existsSync(path.join(abs, "vitest.config.mts")) ||
    existsSync(path.join(abs, "vitest.config.js")) ||
    existsSync(path.join(abs, "vitest.config.mjs"))
  );
}

const BATCH_TIMEOUT_MS = 10 * 60 * 1000;
const KILL_GRACE_MS = 2_000;

function killChildTree(proc: ChildProcessWithoutNullStreams | null): void {
  if (!proc?.pid) return;
  try {
    process.kill(-proc.pid, "SIGTERM");
  } catch {
    try {
      proc.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  setTimeout(() => {
    try {
      if (proc.pid) process.kill(-proc.pid, "SIGKILL");
    } catch {
      try {
        proc.kill("SIGKILL");
      } catch {
        /* ignore */
      }
    }
  }, KILL_GRACE_MS);
}

export function createDogfoodVitestRunner(options: DogfoodVitestRunnerOptions = {}): RunnerAdapter {
  const spawnFn = options.spawnFn ?? spawn;
  const resolveRepoRoot = options.getRepoRoot ?? getRepoRoot;
  const resolveConfig = options.getConfig ?? getHeimdallConfig;
  const resolveCatalog = options.loadCatalog ?? loadTestCatalog;
  let current: TestRunSnapshot | null = null;
  let child: ChildProcessWithoutNullStreams | null = null;
  let cancelled = false;
  const listeners = new Set<SseListener>();

  function broadcast(event: string, data: unknown): void {
    for (const send of [...listeners]) {
      try {
        send(event, data);
      } catch {
        listeners.delete(send);
      }
    }
  }

  function snapshot(): TestRunSnapshot | null {
    return current;
  }

  function appendLog(chunk: string): void {
    if (!current) return;
    current = { ...current, log: current.log + chunk };
    broadcast("log", { chunk });
  }

  function finishRun(status: TestRunSnapshot["status"], exitCode: number | null, summary: TestRunSnapshot["summary"]): void {
    if (!current || current.status !== "running") return;
    current = {
      ...current,
      status,
      exitCode,
      finishedAt: new Date().toISOString(),
      cancelled: status === "cancelled",
      summary,
    };
    broadcast("status", {
      runId: current.runId,
      status: current.status,
    });
    broadcast("snapshot", current);
    broadcast("done", {
      runId: current.runId,
      status: current.status,
      exitCode: current.exitCode,
      summary: current.summary,
      finishedAt: current.finishedAt,
    });
    child = null;
  }

  async function runBatches(batches: PackageBatch[]): Promise<void> {
    const repoRoot = resolveRepoRoot();
    const config = resolveConfig();
    const runAt = new Date().toISOString();
    const commands: string[] = [];
    let mergedOverlay = {
      schemaVersion: 1 as const,
      runAt,
      source: "heimdall-dogfood",
      command: "",
      summary: { passed: 0, failed: 0, skipped: 0 },
      files: {} as Record<string, VitestFileRunResult>,
      cases: {} as Record<string, VitestCaseRunResult>,
    };
    let overallExit: number | null = 0;
    let ranAny = false;

    for (const batch of batches) {
      if (cancelled) break;
      if (!packageHasVitest(repoRoot, batch.packageDir)) {
        appendLog(`[dogfood] skip ${batch.packageDir}: no vitest dependency/config\n`);
        continue;
      }

      const absPkg = path.join(repoRoot, batch.packageDir);
      const tmpDir = mkdtempSync(path.join(tmpdir(), "heimdall-vitest-"));
      const jsonOut = path.join(tmpDir, "vitest.json");
      const args = ["x", "vitest", "run", "--reporter=default", "--reporter=json", `--outputFile=${jsonOut}`, ...batch.packageRelPaths];
      const cmdLabel = `bun --cwd ${batch.packageDir} ${args.join(" ")}`;
      commands.push(cmdLabel);
      appendLog(`[dogfood] $ ${cmdLabel}\n`);
      ranAny = true;

      const code = await new Promise<number | null>((resolve) => {
        let settled = false;
        const settle = (exitCode: number | null) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(exitCode);
        };
        const proc = spawnFn("bun", args, {
          cwd: absPkg,
          env: { ...process.env, FORCE_COLOR: "0" },
          shell: false,
          detached: true,
        }) as ChildProcessWithoutNullStreams;
        child = proc;
        const timer = setTimeout(() => {
          appendLog(`[dogfood] timeout after ${BATCH_TIMEOUT_MS}ms — killing\n`);
          killChildTree(proc);
          settle(1);
        }, BATCH_TIMEOUT_MS);
        proc.stdout.on("data", (buf: Buffer) => appendLog(buf.toString("utf-8")));
        proc.stderr.on("data", (buf: Buffer) => appendLog(buf.toString("utf-8")));
        proc.on("error", (err) => {
          appendLog(`[dogfood] spawn error: ${err.message}\n`);
          settle(1);
        });
        proc.on("close", (exitCode) => settle(exitCode));
      });
      child = null;

      if (cancelled) break;
      if (code == null || code !== 0) overallExit = code == null ? 1 : code;

      let jsonText = "";
      try {
        if (existsSync(jsonOut)) jsonText = readFileSync(jsonOut, "utf-8");
      } catch {
        /* ignore */
      }
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }

      if (!jsonText.trim()) {
        appendLog(`[dogfood] missing vitest JSON for ${batch.packageDir}\n`);
        overallExit = overallExit === 0 ? 1 : overallExit;
        continue;
      }

      const piece = vitestJsonToOverlay(jsonText, repoRoot, {
        command: cmdLabel,
        runAt,
      });
      mergedOverlay = {
        ...mergedOverlay,
        files: { ...mergedOverlay.files, ...piece.files },
        cases: { ...mergedOverlay.cases, ...piece.cases },
        summary: {
          passed: mergedOverlay.summary.passed + piece.summary.passed,
          failed: mergedOverlay.summary.failed + piece.summary.failed,
          skipped: mergedOverlay.summary.skipped + piece.summary.skipped,
        },
      };
    }

    mergedOverlay.command = commands.join(" && ") || "heimdall-dogfood (no packages)";

    if (!current) return;

    if (cancelled) {
      finishRun("cancelled", overallExit, mergedOverlay.summary);
      return;
    }

    if (!ranAny) {
      appendLog("[dogfood] no packages with Vitest ran for this scope\n");
      finishRun("failed", 1, { passed: 0, failed: 0, skipped: 0 });
      return;
    }

    let overlayOk = true;
    try {
      mergeAndWriteVitestRunSnapshot(repoRoot, mergedOverlay, {
        alsoDateCopy: true,
        runsDir: config.paths.vitestRunsDir,
      });
      appendLog(`[dogfood] wrote overlay → ${config.paths.vitestRunsDir}/latest.json\n`);
    } catch (err) {
      overlayOk = false;
      appendLog(`[dogfood] overlay write failed: ${String(err)}\n`);
    }

    const status = !overlayOk || mergedOverlay.summary.failed > 0 || overallExit == null || overallExit !== 0 ? "failed" : "passed";
    finishRun(status, overallExit, mergedOverlay.summary);
  }

  return {
    getVitestCapability(): TestRunCapability {
      return { available: true, run: snapshot() };
    },

    async startVitest(body: unknown): Promise<{ status: number; body: unknown }> {
      if (current?.status === "running") {
        return { status: 409, body: { error: "A Vitest run is already in progress" } };
      }
      const scope = parseTestRunScope(body);
      if ("error" in scope) return { status: 400, body: { error: scope.error } };

      const config = resolveConfig();
      const enabled = resolveEnabledTestLevels(config.pages.testLevels);
      if (scope.scope === "level" && !enabled.has(scope.level)) {
        return { status: 400, body: { error: `level ${scope.level} is disabled in pages.testLevels` } };
      }

      const catalog = resolveCatalog(resolveRepoRoot(), config.paths.testRoots);
      const catalogFiles = catalog.files.filter((f) => enabled.has(f.level as "L1" | "L2" | "L3" | "L4" | "tooling"));
      const resolved = resolveScopedPaths(catalogFiles, scope);
      if ("error" in resolved) return { status: 400, body: { error: resolved.error } };

      const batches = groupPathsByPackage(resolved);
      if (batches.length === 0) {
        return { status: 400, body: { error: "No runnable package batches for scope" } };
      }

      cancelled = false;
      current = {
        runId: randomUUID(),
        scope,
        paths: resolved,
        status: "running",
        startedAt: new Date().toISOString(),
        finishedAt: null,
        exitCode: null,
        cancelled: false,
        log: "",
        summary: null,
      };
      broadcast("snapshot", current);
      broadcast("status", { runId: current.runId, status: "running" });

      void runBatches(batches).catch((err) => {
        appendLog(`[dogfood] fatal: ${String(err)}\n`);
        finishRun("failed", 1, { passed: 0, failed: 0, skipped: 0 });
      });

      return { status: 200, body: { ok: true, run: current } };
    },

    async cancelVitest(): Promise<{ status: number; body: unknown }> {
      if (!current || current.status !== "running") {
        return { status: 200, body: { ok: true, run: current } };
      }
      cancelled = true;
      killChildTree(child);
      appendLog("[dogfood] cancel requested\n");
      return { status: 200, body: { ok: true, run: current } };
    },

    attachVitestStream(send: SseSend): () => void {
      listeners.add(send);
      try {
        if (current) send("snapshot", current);
        else send("idle", {});
      } catch {
        listeners.delete(send);
      }
      return () => {
        listeners.delete(send);
      };
    },

    getUiCapability() {
      return unavailableUiCapability();
    },

    async startUi(): Promise<{ status: number; body: unknown }> {
      return runnersNotConfigured();
    },

    async cancelUi(): Promise<{ status: number; body: unknown }> {
      return runnersNotConfigured();
    },
  };
}
