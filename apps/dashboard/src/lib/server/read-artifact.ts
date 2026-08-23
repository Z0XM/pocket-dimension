import { classifyArtifact } from "$lib/catalog/classify";
import { slugFromSourcePath } from "$lib/catalog/slug";
import { resolveTreePath } from "$lib/server/bmad-root";
import { sanitizeMarkdown } from "$lib/server/markdown";
import type { ArtifactPageData, ArtifactRef, TreeId } from "$lib/types";
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";

const CATALOG_EXTENSIONS = new Set([".md", ".yaml", ".yml"]);

type ResolveArtifactResult = { ok: true; path: string; isDirectory: boolean } | { ok: false; reason: string };

export function resolveArtifactPath(tree: TreeId, sourcePath: string, bmadRoot?: string): ResolveArtifactResult {
  const treeResult = resolveTreePath(tree, bmadRoot);
  if (!treeResult.ok) {
    return { ok: false, reason: treeResult.reason };
  }

  const normalized = sourcePath.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
  if (!normalized || normalized.includes("..")) {
    return { ok: false, reason: "Invalid artifact path." };
  }

  const candidate = join(treeResult.path, ...normalized.split("/"));

  if (!existsSync(candidate)) {
    return { ok: false, reason: "Artifact not found." };
  }

  try {
    const resolvedTree = realpathSync(treeResult.path);
    const resolved = realpathSync(candidate);
    const rel = relative(resolvedTree, resolved);

    if (rel.startsWith("..") || isAbsolute(rel)) {
      return { ok: false, reason: "Path is outside the selected tree." };
    }

    const stat = lstatSync(resolved);
    return { ok: true, path: resolved, isDirectory: stat.isDirectory() };
  } catch {
    return { ok: false, reason: "Could not resolve artifact path." };
  }
}

export function loadArtifact(tree: TreeId, sourcePath: string, bmadRoot?: string): ArtifactPageData {
  const resolved = resolveArtifactPath(tree, sourcePath, bmadRoot);
  if (!resolved.ok) {
    console.warn(`read-artifact: ${sourcePath}: ${resolved.reason}`);
    return { kind: "error", sourcePath, reason: resolved.reason };
  }

  if (resolved.isDirectory) {
    return loadRunFolder(tree, sourcePath, resolved.path, bmadRoot);
  }

  const ext = extension(sourcePath);
  if (ext === ".md") {
    return loadMarkdownFile(tree, sourcePath, resolved.path, bmadRoot);
  }

  if (ext === ".yaml" || ext === ".yml") {
    return loadTextFile(sourcePath, resolved.path);
  }

  console.warn(`read-artifact: ${sourcePath}: unsupported file type`);
  return { kind: "error", sourcePath, reason: "Unsupported artifact type." };
}

function loadMarkdownFile(tree: TreeId, sourcePath: string, fullPath: string, bmadRoot?: string): ArtifactPageData {
  try {
    const raw = readFileSync(fullPath, "utf8");
    const html = sanitizeMarkdown(raw, {
      sourcePath,
      tree,
      exists: (path) => resolveArtifactPath(tree, path, bmadRoot).ok,
    });
    const title = extractTitle(raw, sourcePath);

    return {
      kind: "markdown",
      title,
      sourcePath,
      html,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Could not read file.";
    console.warn(`read-artifact: ${sourcePath}: ${reason}`);
    return { kind: "error", sourcePath, reason };
  }
}

function loadTextFile(sourcePath: string, fullPath: string): ArtifactPageData {
  try {
    const text = readFileSync(fullPath, "utf8");
    return {
      kind: "text",
      title: basenameWithoutExtension(sourcePath),
      sourcePath,
      text,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Could not read file.";
    console.warn(`read-artifact: ${sourcePath}: ${reason}`);
    return { kind: "error", sourcePath, reason };
  }
}

function loadRunFolder(tree: TreeId, sourcePath: string, fullPath: string, bmadRoot?: string): ArtifactPageData {
  const siblings = listCataloguableChildren(fullPath, sourcePath);
  const title = folderTitle(fullPath, sourcePath);

  const prdPath = join(fullPath, "prd.md");
  if (existsSync(prdPath)) {
    const primarySourcePath = `${sourcePath}/prd.md`;
    const primary = loadMarkdownFile(tree, primarySourcePath, prdPath, bmadRoot);
    if (primary.kind === "markdown") {
      return {
        kind: "run-folder",
        title,
        sourcePath,
        primary: {
          title: primary.title,
          sourcePath: primarySourcePath,
          html: primary.html,
        },
        siblings: siblings.filter((s) => s.sourcePath !== primarySourcePath),
      };
    }
  }

  return {
    kind: "run-folder",
    title,
    sourcePath,
    siblings,
  };
}

function listCataloguableChildren(fullPath: string, relativeDir: string): { title: string; sourcePath: string }[] {
  let entries: string[];

  try {
    entries = readdirSync(fullPath);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    console.warn(`read-artifact: could not read directory ${relativeDir}: ${reason}`);
    return [];
  }

  const siblings: { title: string; sourcePath: string }[] = [];

  for (const entry of entries) {
    const ext = extension(entry);
    if (!CATALOG_EXTENSIONS.has(ext)) {
      continue;
    }

    const childPath = join(fullPath, entry);
    let stat;
    try {
      stat = lstatSync(childPath);
    } catch {
      continue;
    }

    if (!stat.isFile()) {
      continue;
    }

    const childSourcePath = `${relativeDir}/${entry}`;
    try {
      const head = readFileSync(childPath, "utf8").slice(0, 8192);
      siblings.push({
        title: extractTitle(head, childSourcePath),
        sourcePath: childSourcePath,
      });
    } catch {
      siblings.push({
        title: basenameWithoutExtension(childSourcePath),
        sourcePath: childSourcePath,
      });
    }
  }

  return siblings.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
}

function folderTitle(fullPath: string, sourcePath: string): string {
  const prdPath = join(fullPath, "prd.md");
  if (existsSync(prdPath)) {
    try {
      const head = readFileSync(prdPath, "utf8").slice(0, 8192);
      const match = head.match(/^#\s+(.+)$/m);
      if (match?.[1]) {
        return match[1].trim();
      }
    } catch {
      // fall through
    }
  }

  const designPath = join(fullPath, "DESIGN.md");
  if (existsSync(designPath)) {
    try {
      const head = readFileSync(designPath, "utf8").slice(0, 8192);
      const match = head.match(/^#\s+(.+)$/m);
      if (match?.[1]) {
        return match[1].trim();
      }
    } catch {
      // fall through
    }
  }

  return sourcePath.split("/").pop() ?? sourcePath;
}

function extractTitle(content: string, sourcePath: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  if (match?.[1]) {
    return match[1].trim();
  }
  return basenameWithoutExtension(sourcePath);
}

function basenameWithoutExtension(sourcePath: string): string {
  const basename = sourcePath.split("/").pop() ?? sourcePath;
  return basename.replace(/\.(md|ya?ml)$/i, "");
}

function extension(filename: string): string {
  return filename.includes(".") ? `.${filename.split(".").pop()!.toLowerCase()}` : "";
}

export function buildDirectoryArtifact(sourcePath: string, fullPath: string): ArtifactRef {
  const prdPath = join(fullPath, "prd.md");
  const designPath = join(fullPath, "DESIGN.md");
  let classifyPath = sourcePath;
  let head = "";

  if (existsSync(prdPath)) {
    classifyPath = `${sourcePath}/prd.md`;
    try {
      head = readFileSync(prdPath, "utf8").slice(0, 8192);
    } catch {
      // empty head
    }
  } else if (existsSync(designPath)) {
    classifyPath = `${sourcePath}/DESIGN.md`;
    try {
      head = readFileSync(designPath, "utf8").slice(0, 8192);
    } catch {
      // empty head
    }
  } else {
    classifyPath = `${sourcePath}/`;
  }

  const artifactKind = classifyArtifact(classifyPath, head || undefined);
  const title = folderTitle(fullPath, sourcePath);

  return {
    id: slugFromSourcePath(sourcePath),
    title,
    artifactKind,
    sourcePath,
  };
}

export function isRunFolderDirectory(relativeDir: string, fullPath: string): boolean {
  const prdPath = join(fullPath, "prd.md");
  if (existsSync(prdPath) && lstatSync(prdPath).isFile()) {
    return true;
  }

  const normalized = relativeDir.replace(/\\/g, "/");
  const segments = normalized.split("/");
  const underPrdsOrUx = segments.includes("prds") || segments.includes("ux-designs");
  if (!underPrdsOrUx) {
    return false;
  }

  return hasCataloguableChild(fullPath);
}

function hasCataloguableChild(fullPath: string): boolean {
  try {
    for (const entry of readdirSync(fullPath)) {
      const ext = extension(entry);
      if (!CATALOG_EXTENSIONS.has(ext)) {
        continue;
      }
      const childPath = join(fullPath, entry);
      if (existsSync(childPath) && lstatSync(childPath).isFile()) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}
