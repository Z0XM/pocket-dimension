import { classifyArtifact } from "$lib/catalog/classify";
import { slugFromSourcePath } from "$lib/catalog/slug";
import { resolveTreePath } from "$lib/server/bmad-root";
import type { ArtifactRef, TreeId, TreeSnapshot } from "$lib/types";
import { closeSync, openSync, readSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const CATALOG_EXTENSIONS = new Set([".md", ".yaml", ".yml"]);
const SKIP_DIRS = new Set([".git", "node_modules"]);
const HEAD_BYTES = 8192;

export function loadTreeSnapshot(tree: TreeId): TreeSnapshot | { tree: TreeId; artifacts: []; error?: string } {
  const resolved = resolveTreePath(tree);
  if (!resolved.ok) {
    return { tree, artifacts: [], error: resolved.reason };
  }

  const artifacts: ArtifactRef[] = [];
  walkTree(resolved.path, resolved.path, artifacts);
  artifacts.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));

  return { tree, artifacts };
}

function walkTree(rootPath: string, currentPath: string, artifacts: ArtifactRef[]): void {
  let entries: string[];

  try {
    entries = readdirSync(currentPath);
  } catch (error) {
    const rel = toRelativePath(rootPath, currentPath);
    console.warn(`read-tree: could not read directory ${rel}: ${error instanceof Error ? error.message : "unknown"}`);
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) {
      continue;
    }

    const fullPath = join(currentPath, entry);

    let stat;
    try {
      stat = statSync(fullPath);
    } catch (error) {
      const rel = toRelativePath(rootPath, fullPath);
      console.warn(`read-tree: could not stat ${rel}: ${error instanceof Error ? error.message : "unknown"}`);
      continue;
    }

    if (stat.isDirectory()) {
      walkTree(rootPath, fullPath, artifacts);
      continue;
    }

    if (!stat.isFile()) {
      continue;
    }

    const ext = entry.includes(".") ? `.${entry.split(".").pop()!.toLowerCase()}` : "";
    if (!CATALOG_EXTENSIONS.has(ext)) {
      continue;
    }

    const sourcePath = toRelativePath(rootPath, fullPath);
    artifacts.push(buildArtifact(sourcePath, fullPath));
  }
}

function buildArtifact(sourcePath: string, fullPath: string): ArtifactRef {
  try {
    const head = readFileHead(fullPath);
    const artifactKind = classifyArtifact(sourcePath, head);
    const title = extractTitle(head, sourcePath);

    return {
      id: slugFromSourcePath(sourcePath),
      title,
      artifactKind,
      sourcePath,
    };
  } catch (error) {
    console.warn(`read-tree: could not read ${sourcePath}: ${error instanceof Error ? error.message : "unknown"}`);
    return {
      id: slugFromSourcePath(sourcePath),
      title: basenameWithoutExtension(sourcePath),
      artifactKind: "unclassified",
      sourcePath,
      error: error instanceof Error ? error.message : "Could not read file.",
    };
  }
}

function readFileHead(fullPath: string): string {
  const fd = openSync(fullPath, "r");
  try {
    const buffer = Buffer.alloc(HEAD_BYTES);
    const bytesRead = readSync(fd, buffer, 0, HEAD_BYTES, 0);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    closeSync(fd);
  }
}

function extractTitle(head: string, sourcePath: string): string {
  const match = head.match(/^#\s+(.+)$/m);
  if (match?.[1]) {
    return match[1].trim();
  }
  return basenameWithoutExtension(sourcePath);
}

function basenameWithoutExtension(sourcePath: string): string {
  const basename = sourcePath.split("/").pop() ?? sourcePath;
  return basename.replace(/\.(md|ya?ml)$/i, "");
}

function toRelativePath(rootPath: string, fullPath: string): string {
  return relative(rootPath, fullPath).split(sep).join("/");
}
