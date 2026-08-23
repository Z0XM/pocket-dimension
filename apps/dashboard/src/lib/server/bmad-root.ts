import { existsSync, lstatSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Canonical Current BMAD Trees — README order; not derived from `_bmad-output/*` glob. */
export const CURRENT_BMAD_TREES = ["pocket-dimension", "zeo", "chhan-chhan"] as const;

export type TreeId = (typeof CURRENT_BMAD_TREES)[number];

export type BmadRootSuccess = {
  ok: true;
  root: string;
};

export type BmadRootFailure = {
  ok: false;
  error: string;
};

export type BmadRootResult = BmadRootSuccess | BmadRootFailure;

export type ListTreesResult = {
  trees: TreeId[];
  bmadRootError?: string;
};

export type ResolveTreePathResult = { ok: true; path: string } | { ok: false; reason: string };

const BMAD_OUTPUT_DIR = "_bmad-output";

export function isTreeId(value: string): value is TreeId {
  return (CURRENT_BMAD_TREES as readonly string[]).includes(value);
}

/**
 * Walk up from `import.meta.dir` and/or `process.cwd()` until a directory
 * containing `_bmad-output/` exists; return its realpath.
 */
export function resolveBmadRoot(startDirs: string[] = defaultStartDirs()): BmadRootResult {
  const visited = new Set<string>();

  for (const startDir of startDirs.filter(Boolean)) {
    let current = resolve(startDir);

    while (!visited.has(current)) {
      visited.add(current);

      const bmadOutputPath = join(current, BMAD_OUTPUT_DIR);
      if (existsSync(bmadOutputPath) && lstatSync(bmadOutputPath).isDirectory()) {
        try {
          return { ok: true, root: realpathSync(current) };
        } catch {
          return { ok: false, error: "Could not resolve BMAD Root path." };
        }
      }

      const parent = dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
  }

  return {
    ok: false,
    error: "`_bmad-output` was not found from the app working directory.",
  };
}

/**
 * Allow-listed slugs that exist on disk after realpath — never leftover siblings.
 */
export function listCurrentTrees(bmadRoot?: string): ListTreesResult {
  const rootResult = bmadRoot ? resolveExistingRoot(bmadRoot) : resolveBmadRoot();
  if (!rootResult.ok) {
    return { trees: [], bmadRootError: rootResult.error };
  }

  const trees: TreeId[] = [];

  for (const slug of CURRENT_BMAD_TREES) {
    const treePath = join(rootResult.root, BMAD_OUTPUT_DIR, slug);
    if (!existsSync(treePath) || !lstatSync(treePath).isDirectory()) {
      continue;
    }

    try {
      realpathSync(treePath);
      trees.push(slug);
    } catch {
      // unreadable tree directory — skip
    }
  }

  return { trees };
}

/**
 * Resolve a tree directory under the allow-list; reject symlink escape / `..`.
 */
export function resolveTreePath(slug: string, bmadRoot?: string): ResolveTreePathResult {
  if (!isTreeId(slug)) {
    return { ok: false, reason: "Tree is not in the Current BMAD Trees allow-list." };
  }

  const rootResult = bmadRoot ? resolveExistingRoot(bmadRoot) : resolveBmadRoot();
  if (!rootResult.ok) {
    return { ok: false, reason: rootResult.error };
  }

  const bmadOutputPath = join(rootResult.root, BMAD_OUTPUT_DIR);
  const treePath = join(bmadOutputPath, slug);

  if (!existsSync(treePath)) {
    return { ok: false, reason: `Tree directory "${slug}" was not found on disk.` };
  }

  try {
    const resolvedBmadOutput = realpathSync(bmadOutputPath);
    const resolvedTree = realpathSync(treePath);
    const rel = relative(resolvedBmadOutput, resolvedTree);

    if (rel.startsWith("..") || rel.split(sep)[0] !== slug) {
      return { ok: false, reason: `Resolved path for "${slug}" is outside the allow-list.` };
    }

    return { ok: true, path: resolvedTree };
  } catch {
    return { ok: false, reason: `Could not resolve path for tree "${slug}".` };
  }
}

function defaultStartDirs(): string[] {
  const dirs: string[] = [];

  if (typeof import.meta.dir === "string") {
    dirs.push(import.meta.dir);
  } else if (typeof import.meta.url === "string") {
    dirs.push(dirname(fileURLToPath(import.meta.url)));
  }

  dirs.push(process.cwd());
  return dirs;
}

function resolveExistingRoot(bmadRoot: string): BmadRootResult {
  const bmadOutputPath = join(bmadRoot, BMAD_OUTPUT_DIR);
  if (!existsSync(bmadOutputPath) || !lstatSync(bmadOutputPath).isDirectory()) {
    return {
      ok: false,
      error: "`_bmad-output` was not found from the app working directory.",
    };
  }

  try {
    return { ok: true, root: realpathSync(bmadRoot) };
  } catch {
    return { ok: false, error: "Could not resolve BMAD Root path." };
  }
}
