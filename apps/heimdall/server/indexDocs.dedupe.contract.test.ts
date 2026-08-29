import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig } from "../src/config/schema.js";
import { buildSearchDocuments, indexDocs } from "./indexDocs.js";
import { DocSearchIndex } from "./searchIndex.js";

describe("indexDocs nested docsRoot + extraRoots", () => {
  it("dedupes paths when docsRoot is inside an extraRoot (Pocket Dimension dogfood)", () => {
    const root = mkdtempSync(path.join(tmpdir(), "heimdall-docs-dedupe-"));
    const nested = path.join(root, "_bmad-output", "pocket-dimension");
    const zeoDir = path.join(root, "_bmad-output", "zeo");
    mkdirSync(nested, { recursive: true });
    mkdirSync(zeoDir, { recursive: true });
    writeFileSync(path.join(nested, "api-contracts-auth-service.md"), "# Auth contracts\n\nBody.\n");
    writeFileSync(path.join(nested, "project-context.md"), "# Context\n");
    writeFileSync(path.join(zeoDir, "README.md"), "# zeo\n");

    const config = defineConfig({
      paths: { docsRoot: "_bmad-output/pocket-dimension" },
      docs: { extraRoots: ["_bmad-output"] },
    });

    const catalog = indexDocs(root, config);
    const paths = catalog.docs.map((d) => d.path);
    expect(paths.filter((p) => p === "_bmad-output/pocket-dimension/api-contracts-auth-service.md")).toHaveLength(1);
    expect(paths).toContain("_bmad-output/pocket-dimension/project-context.md");
    expect(paths).toContain("_bmad-output/zeo/README.md");
    expect(new Set(paths).size).toBe(paths.length);

    const searchDocs = buildSearchDocuments(root, catalog, config);
    const index = new DocSearchIndex();
    expect(() => index.rebuild(searchDocs)).not.toThrow();
    expect(index.search("Auth contracts").length).toBeGreaterThan(0);
  });

  it("DocSearchIndex.rebuild skips duplicate ids without throwing", () => {
    const index = new DocSearchIndex();
    const dup = {
      id: "_bmad-output/pocket-dimension/api-contracts-auth-service.md",
      path: "_bmad-output/pocket-dimension/api-contracts-auth-service.md",
      title: "Auth",
      category: "planning" as const,
      headings: "Auth",
      body: "contracts",
    };
    expect(() => index.rebuild([dup, { ...dup, body: "second" }])).not.toThrow();
    expect(index.search("contracts")).toHaveLength(1);
  });
});
