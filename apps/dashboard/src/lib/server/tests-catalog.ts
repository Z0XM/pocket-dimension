import { encodePathSegments } from "$lib/docs-path";
import { slugFromSourcePath } from "$lib/catalog/slug";
import { resolveBmadRoot } from "$lib/server/bmad-root";
import type { TestCatalogEntry, TreeId } from "$lib/types";
import { existsSync, lstatSync, readdirSync, realpathSync } from "node:fs";
import { basename, isAbsolute, join, relative } from "node:path";

const SKIP_DIRS = new Set(["node_modules", ".svelte-kit", "dist", "build", ".git"]);
const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|js)$/i;

let rootResolveWarned = false;

/** Scan apps/** for *.test.ts / *.spec.ts (and *.test.js / *.spec.js). Never _bmad-output. */
export function loadTestsCatalog(repoRoot?: string): TestCatalogEntry[] {
  const rootResult = repoRoot ? resolveExistingRepoRoot(repoRoot) : resolveBmadRoot();
  if (!rootResult.ok) {
    if (!rootResolveWarned) {
      console.warn(`tests-catalog: ${rootResult.error}`);
      rootResolveWarned = true;
    }
    return [];
  }

  const appsPath = join(rootResult.root, "apps");
  if (!existsSync(appsPath)) {
    return [];
  }

  let resolvedAppsRoot: string;
  try {
    resolvedAppsRoot = realpathSync(appsPath);
  } catch {
    return [];
  }

  const entries: TestCatalogEntry[] = [];
  walkApps(resolvedAppsRoot, resolvedAppsRoot, rootResult.root, entries);
  entries.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  return entries;
}

function resolveExistingRepoRoot(repoRoot: string): { ok: true; root: string } | { ok: false; error: string } {
  const bmadOutputPath = join(repoRoot, "_bmad-output");
  if (!existsSync(bmadOutputPath) || !lstatSync(bmadOutputPath).isDirectory()) {
    return {
      ok: false,
      error: "`_bmad-output` was not found from the app working directory.",
    };
  }

  try {
    return { ok: true, root: realpathSync(repoRoot) };
  } catch {
    return { ok: false, error: "Could not resolve BMAD Root path." };
  }
}

function walkApps(resolvedAppsRoot: string, currentPath: string, repoRoot: string, entries: TestCatalogEntry[]): void {
  let dirEntries: string[];

  try {
    dirEntries = readdirSync(currentPath);
  } catch (error) {
    const rel = toRepoRelative(repoRoot, currentPath);
    console.warn(`tests-catalog: could not read directory ${rel}: ${error instanceof Error ? error.message : "unknown"}`);
    return;
  }

  for (const entry of dirEntries) {
    if (SKIP_DIRS.has(entry)) {
      continue;
    }

    const fullPath = join(currentPath, entry);

    let stat;
    try {
      stat = lstatSync(fullPath);
    } catch (error) {
      const rel = toRepoRelative(repoRoot, fullPath);
      console.warn(`tests-catalog: could not stat ${rel}: ${error instanceof Error ? error.message : "unknown"}`);
      continue;
    }

    if (!isContainedInApps(resolvedAppsRoot, repoRoot, fullPath)) {
      continue;
    }

    if (stat.isDirectory()) {
      walkApps(resolvedAppsRoot, fullPath, repoRoot, entries);
      continue;
    }

    if (!stat.isFile() || !TEST_FILE_PATTERN.test(entry)) {
      continue;
    }

    const sourcePath = toRepoRelative(repoRoot, fullPath);
    entries.push(buildTestEntry(sourcePath));
  }
}

function isContainedInApps(resolvedAppsRoot: string, repoRoot: string, fullPath: string): boolean {
  const relPath = toRepoRelative(repoRoot, fullPath);

  try {
    const resolved = realpathSync(fullPath);
    const rel = relative(resolvedAppsRoot, resolved);

    if (rel.startsWith("..") || isAbsolute(rel)) {
      console.warn(`tests-catalog: skipping path outside apps ${relPath}`);
      return false;
    }

    return true;
  } catch {
    console.warn(`tests-catalog: could not resolve ${relPath}`);
    return false;
  }
}

function buildTestEntry(sourcePath: string): TestCatalogEntry {
  const normalized = sourcePath.replace(/\\/g, "/");
  const id = slugFromSourcePath(normalized);
  const name = basename(normalized);

  return {
    id,
    name,
    sourcePath: normalized,
    treeHint: treeHintFromPath(normalized),
    relatedStoryHref: null,
    href: `/tests/${encodePathSegments(normalized)}`,
  };
}

function treeHintFromPath(sourcePath: string): TreeId | null {
  if (sourcePath.startsWith("apps/zeo/")) {
    return "zeo";
  }
  if (sourcePath.startsWith("apps/chhan-chhan/")) {
    return "chhan-chhan";
  }
  return null;
}

function toRepoRelative(repoRoot: string, fullPath: string): string {
  return relative(repoRoot, fullPath).replace(/\\/g, "/");
}
