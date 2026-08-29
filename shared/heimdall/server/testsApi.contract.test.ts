import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { handleApiRequest, type ApiResult } from "./apiState.js";
import { initHeimdallRuntime } from "./runtime.js";
import { setRunnerAdapter } from "./runners.js";

function expectJson(result: ApiResult): Extract<ApiResult, { kind: "json" }> {
  expect(result.kind).toBe("json");
  if (result.kind !== "json") {
    throw new Error(`Expected json result, received ${result.kind}`);
  }
  return result;
}

describe("tests api contract", () => {
  const previousRepoRoot = process.env.HEIMDALL_REPO_ROOT;
  const previousBasePath = process.env.HEIMDALL_BASE_PATH;

  beforeEach(async () => {
    delete process.env.HEIMDALL_REPO_ROOT;
    delete process.env.HEIMDALL_BASE_PATH;
    setRunnerAdapter(null);
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-tests-api-"));
    await initHeimdallRuntime({ cwd: root, basePath: "/heimdall" });
  });

  afterEach(() => {
    setRunnerAdapter(null);
    if (previousRepoRoot === undefined) delete process.env.HEIMDALL_REPO_ROOT;
    else process.env.HEIMDALL_REPO_ROOT = previousRepoRoot;
    if (previousBasePath === undefined) delete process.env.HEIMDALL_BASE_PATH;
    else process.env.HEIMDALL_BASE_PATH = previousBasePath;
  });

  it("returns soft-empty catalogs when configured dirs are absent", async () => {
    const tests = expectJson(await handleApiRequest("/tests", "GET", new URLSearchParams()));
    expect(tests.status).toBe(200);
    expect((tests.body as { files: unknown[] }).files).toEqual([]);
    expect((tests.body as { summary: { fileCount: number; caseCount: number } }).summary).toMatchObject({
      fileCount: 0,
      caseCount: 0,
    });
    expect((tests.body as { enabledLevels: string[] }).enabledLevels).toEqual(["L1", "L2", "L3", "L4", "tooling", "L5"]);

    const uiCases = expectJson(await handleApiRequest("/ui-cases", "GET", new URLSearchParams()));
    expect(uiCases.status).toBe(200);
    expect((uiCases.body as { cases: unknown[] }).cases).toEqual([]);
    expect((uiCases.body as { summary: { screenCount: number; caseCount: number } }).summary).toMatchObject({
      screenCount: 0,
      caseCount: 0,
    });
  });

  it("honors pages.testLevels on GET /tests enabledLevels", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-tests-levels-"));
    const { writeFileSync } = await import("node:fs");
    writeFileSync(path.join(root, "heimdall.config.mjs"), `export default { pages: { tests: true, testLevels: ["L1"] } };\n`, "utf-8");
    await initHeimdallRuntime({ cwd: root, basePath: "/heimdall" });
    const tests = expectJson(await handleApiRequest("/tests", "GET", new URLSearchParams()));
    expect((tests.body as { enabledLevels: string[] }).enabledLevels).toEqual(["L1"]);
  });

  it("reports unavailable capabilities and rejects run posts without an adapter", async () => {
    const vitestCapability = expectJson(await handleApiRequest("/tests/run", "GET", new URLSearchParams()));
    expect(vitestCapability.status).toBe(200);
    expect(vitestCapability.body).toEqual({ available: false, run: null });

    const uiCapability = expectJson(await handleApiRequest("/ui-tests/run", "GET", new URLSearchParams()));
    expect(uiCapability.status).toBe(200);
    expect(uiCapability.body).toMatchObject({
      available: false,
      webAppConfigured: false,
      hostCredentialsConfigured: false,
      run: null,
    });

    const vitestPost = expectJson(
      await handleApiRequest("/tests/run", "POST", new URLSearchParams(), JSON.stringify({ scope: "level", level: "L1" }))
    );
    expect(vitestPost.status).toBe(403);
    expect(vitestPost.body).toEqual({ error: "runners not configured" });

    const uiPost = expectJson(await handleApiRequest("/ui-tests/run", "POST", new URLSearchParams(), JSON.stringify({ scope: "all" })));
    expect(uiPost.status).toBe(403);
    expect(uiPost.body).toEqual({ error: "runners not configured" });
  });
});
