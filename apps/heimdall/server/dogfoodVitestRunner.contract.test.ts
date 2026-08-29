import { describe, expect, it } from "vitest";
import {
  createDogfoodVitestRunner,
  groupPathsByPackage,
  packageRootForTestPath,
  parseTestRunScope,
  resolveScopedPaths,
  vitestJsonToOverlay,
} from "./dogfoodVitestRunner.js";

describe("dogfoodVitestRunner helpers", () => {
  it("maps package root from repo-relative path", () => {
    expect(packageRootForTestPath("heimdall/src/foo.test.ts")).toBe("heimdall");
    expect(packageRootForTestPath("fastify/src/flows/engine.test.ts")).toBe("fastify");
  });

  it("groups paths by package", () => {
    const batches = groupPathsByPackage(["heimdall/src/a.test.ts", "heimdall/server/b.test.ts", "fastify/src/c.test.ts"]);
    expect(batches.map((b) => b.packageDir)).toEqual(["fastify", "heimdall"]);
    expect(batches.find((b) => b.packageDir === "heimdall")!.packageRelPaths).toEqual(["src/a.test.ts", "server/b.test.ts"]);
  });

  it("parses run scopes", () => {
    expect(parseTestRunScope({ scope: "level", level: "L1" })).toEqual({
      scope: "level",
      level: "L1",
    });
    expect(parseTestRunScope({ scope: "file", path: "heimdall/src/x.test.ts" })).toEqual({
      scope: "file",
      path: "heimdall/src/x.test.ts",
    });
    expect(parseTestRunScope({ scope: "all" })).toMatchObject({ error: expect.any(String) });
  });

  it("rejects path traversal in file scope", () => {
    expect(parseTestRunScope({ scope: "file", path: "../secret.test.ts" })).toMatchObject({
      error: expect.stringContaining("repo"),
    });
  });

  it("resolves scoped paths from catalog", () => {
    const catalog = [
      { path: "heimdall/src/a.test.ts", level: "L1" },
      { path: "heimdall/src/b.test.ts", level: "L2" },
    ];
    expect(resolveScopedPaths(catalog, { scope: "level", level: "L1" })).toEqual(["heimdall/src/a.test.ts"]);
    expect(resolveScopedPaths(catalog, { scope: "file", path: "missing.test.ts" })).toMatchObject({
      error: expect.stringContaining("Unknown"),
    });
  });

  it("maps vitest JSON reporter into overlay", () => {
    const json = JSON.stringify({
      testResults: [
        {
          name: "/repo/heimdall/src/a.test.ts",
          status: "failed",
          assertionResults: [
            {
              title: "works",
              ancestorTitles: ["Suite"],
              status: "passed",
              duration: 3,
            },
            {
              title: "breaks",
              ancestorTitles: ["Suite"],
              status: "failed",
              failureMessages: ["boom"],
            },
          ],
        },
      ],
    });
    const snap = vitestJsonToOverlay(json, "/repo", {
      command: "bun x vitest",
      runAt: "2026-08-27T00:00:00.000Z",
    });
    expect(snap.source).toBe("heimdall-dogfood");
    expect(snap.summary).toEqual({ passed: 1, failed: 1, skipped: 0 });
    expect(snap.files["heimdall/src/a.test.ts"]?.failed).toBe(1);
    expect(snap.cases["heimdall/src/a.test.ts::Suite::breaks"]?.error).toBe("boom");
  });
});

describe("createDogfoodVitestRunner", () => {
  it("reports Vitest available and UI unavailable", async () => {
    const adapter = createDogfoodVitestRunner({
      spawnFn: (() => {
        throw new Error("spawn should not run");
      }) as never,
    });
    expect(await adapter.getVitestCapability()).toEqual({ available: true, run: null });
    expect((await adapter.getUiCapability()).available).toBe(false);
    const ui = await adapter.startUi({});
    expect(ui.status).toBe(403);
  });

  it("rejects invalid scope bodies with 400", async () => {
    const adapter = createDogfoodVitestRunner();
    const bad = await adapter.startVitest({ scope: "file" });
    expect(bad.status).toBe(400);
    expect((bad.body as { error: string }).error).toMatch(/path/i);
  });

  it("returns 409 when a run is already in progress", async () => {
    const { mkdtempSync, writeFileSync, mkdirSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const pathMod = await import("node:path");
    const { EventEmitter } = await import("node:events");
    const { defineConfig } = await import("../src/config/schema.js");

    const root = mkdtempSync(pathMod.join(tmpdir(), "heimdall-dogfood-busy-"));
    mkdirSync(pathMod.join(root, "pkg", "src"), { recursive: true });
    writeFileSync(pathMod.join(root, "pkg", "package.json"), JSON.stringify({ name: "pkg", devDependencies: { vitest: "^4.0.0" } }));

    const adapter = createDogfoodVitestRunner({
      getRepoRoot: () => root,
      getConfig: () =>
        defineConfig({
          pages: { tests: true },
          paths: { testRoots: ["pkg/src"] },
        }),
      loadCatalog: () => ({
        files: [
          {
            path: "pkg/src/a.test.ts",
            area: "pkg",
            level: "L1",
            suiteName: "a",
            cases: [{ name: "x", suitePath: [] }],
            caseCount: 1,
          },
        ],
        summary: {
          fileCount: 1,
          caseCount: 1,
          byLevel: { L1: 1, L2: 0, L3: 0, L4: 0, tooling: 0 },
        },
        generatedAt: new Date().toISOString(),
      }),
      spawnFn: (() => {
        const proc = new EventEmitter() as import("node:child_process").ChildProcessWithoutNullStreams;
        proc.stdout = new EventEmitter() as never;
        proc.stderr = new EventEmitter() as never;
        Object.defineProperty(proc, "pid", { value: 999999 });
        proc.kill = () => true;
        return proc;
      }) as unknown as typeof import("node:child_process").spawn,
    });

    const first = await adapter.startVitest({ scope: "file", path: "pkg/src/a.test.ts" });
    expect(first.status).toBe(200);
    // Let the async batch reach the hung spawn so status stays "running".
    await new Promise((r) => setTimeout(r, 10));
    const second = await adapter.startVitest({ scope: "file", path: "pkg/src/a.test.ts" });
    expect(second.status).toBe(409);
    await adapter.cancelVitest();
  });
});
