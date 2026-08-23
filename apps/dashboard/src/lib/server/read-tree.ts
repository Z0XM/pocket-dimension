import { classifyArtifact } from "$lib/catalog/classify";
import { extractStatusLine, mapStatusLabel } from "$lib/catalog/status";
import { slugFromSourcePath } from "$lib/catalog/slug";
import { resolveTreePath } from "$lib/server/bmad-root";
import { buildDirectoryArtifact, isRunFolderDirectory } from "$lib/server/read-artifact";
import type { ArtifactRef, TreeId, TreeSnapshot } from "$lib/types";
import { closeSync, openSync, readSync, readdirSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";

const CATALOG_EXTENSIONS = new Set([".md", ".yaml", ".yml"]);
const SKIP_DIRS = new Set([".git", "node_modules"]);
const HEAD_BYTES = 8192;

export function loadTreeSnapshot(tree: TreeId, bmadRoot?: string): TreeSnapshot | { tree: TreeId; artifacts: []; error?: string } {
  const resolved = resolveTreePath(tree, bmadRoot);
  if (!resolved.ok) {
    return { tree, artifacts: [], error: resolved.reason };
  }

  let resolvedTreeRoot: string;
  try {
    resolvedTreeRoot = realpathSync(resolved.path);
  } catch {
    return { tree, artifacts: [], error: `Could not resolve path for tree "${tree}".` };
  }

  const artifacts: ArtifactRef[] = [];
  walkTree(resolvedTreeRoot, resolved.path, resolved.path, artifacts);
  artifacts.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));

  return { tree, artifacts };
}

function walkTree(resolvedTreeRoot: string, rootPath: string, currentPath: string, artifacts: ArtifactRef[]): void {
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

    if (!isContainedInTree(resolvedTreeRoot, rootPath, fullPath)) {
      continue;
    }

    if (stat.isDirectory()) {
      const sourcePath = toRelativePath(rootPath, fullPath);
      if (isRunFolderDirectory(sourcePath, fullPath)) {
        artifacts.push(buildDirectoryArtifact(sourcePath, fullPath));
      }
      walkTree(resolvedTreeRoot, rootPath, fullPath, artifacts);
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

/** Returns true when fullPath realpath stays inside resolvedTreeRoot; logs and rejects escapes. */
export function isContainedInTree(resolvedTreeRoot: string, rootPath: string, fullPath: string): boolean {
  const relPath = toRelativePath(rootPath, fullPath);

  try {
    const resolved = realpathSync(fullPath);
    const rel = relative(resolvedTreeRoot, resolved);

    if (rel.startsWith("..") || isAbsolute(rel)) {
      console.warn(`read-tree: skipping path outside tree ${relPath}`);
      return false;
    }

    return true;
  } catch (error) {
    console.warn(`read-tree: could not resolve ${relPath}: ${error instanceof Error ? error.message : "unknown"}`);
    return false;
  }
}

function buildArtifact(sourcePath: string, fullPath: string): ArtifactRef {
  try {
    const head = readFileHead(fullPath);
    const artifactKind = classifyArtifact(sourcePath, head);
    const title = extractTitle(head, sourcePath);

    const ref: ArtifactRef = {
      id: slugFromSourcePath(sourcePath),
      title,
      artifactKind,
      sourcePath,
    };

    if (artifactKind === "story" || artifactKind === "epic") {
      const statusRaw = extractStatusLine(head);
      if (statusRaw) {
        const mapped = mapStatusLabel(statusRaw);
        ref.status = mapped.status;
        ref.statusLabel = mapped.statusLabel;
      }
    }

    return ref;
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
