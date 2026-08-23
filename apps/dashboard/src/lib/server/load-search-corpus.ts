import { encodePathSegments } from "$lib/docs-path";
import { loadFeaturesForTree } from "$lib/server/load-features";
import { resolveArtifactPath } from "$lib/server/read-artifact";
import { loadTreeSnapshot } from "$lib/server/read-tree";
import type { ArtifactKind, SearchCorpusEntry, SearchHitKind, TreeId } from "$lib/types";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BINARY_CHECK_BYTES = 8192;

function isBinaryBuffer(buffer: Buffer): boolean {
  return buffer.subarray(0, Math.min(buffer.length, BINARY_CHECK_BYTES)).includes(0);
}

function readTextFile(fullPath: string, sourcePath: string): string | null {
  try {
    const buffer = readFileSync(fullPath);
    if (isBinaryBuffer(buffer)) {
      console.warn(`load-search-corpus: skipping binary file ${sourcePath}`);
      return null;
    }
    return buffer.toString("utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Could not read file.";
    console.warn(`load-search-corpus: ${sourcePath}: ${reason}`);
    return null;
  }
}

function artifactKindToSearchKind(kind: ArtifactKind): SearchHitKind {
  if (kind === "epic") {
    return "epic";
  }
  if (kind === "story") {
    return "story";
  }
  return "docs";
}

function docsHref(tree: TreeId, sourcePath: string): string {
  return `/docs/${encodePathSegments(sourcePath)}?tree=${tree}`;
}

function epicStoryHref(kind: "epic" | "story", tree: TreeId, id: string): string {
  const segment = kind === "epic" ? "epics" : "stories";
  return `/${segment}/${id}?tree=${tree}`;
}

function extractSectionAroundFeature(markdown: string, featureId: string): string {
  const lines = markdown.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.includes(featureId)) {
      return lines
        .slice(i, i + 40)
        .join("\n")
        .slice(0, 600);
    }
  }
  return "";
}

function pushArtifactEntries(tree: TreeId, snapshot: ReturnType<typeof loadTreeSnapshot>, entries: SearchCorpusEntry[]): void {
  if ("error" in snapshot && snapshot.error) {
    return;
  }

  for (const artifact of snapshot.artifacts) {
    const resolved = resolveArtifactPath(tree, artifact.sourcePath);
    if (!resolved.ok) {
      console.warn(`load-search-corpus: ${artifact.sourcePath}: ${resolved.reason}`);
      continue;
    }

    if (resolved.isDirectory) {
      const prdPath = join(resolved.path, "prd.md");
      if (!existsSync(prdPath)) {
        continue;
      }
      const prdSourcePath = `${artifact.sourcePath}/prd.md`;
      const text = readTextFile(prdPath, prdSourcePath);
      if (!text) {
        continue;
      }
      entries.push({
        kind: artifactKindToSearchKind(artifact.artifactKind),
        id: artifact.id,
        title: artifact.title,
        tree,
        text,
        href: docsHref(tree, prdSourcePath),
      });
      continue;
    }

    const text = readTextFile(resolved.path, artifact.sourcePath);
    if (!text) {
      continue;
    }

    const searchKind = artifactKindToSearchKind(artifact.artifactKind);
    const href = searchKind === "epic" || searchKind === "story" ? epicStoryHref(searchKind, tree, artifact.id) : docsHref(tree, artifact.sourcePath);

    entries.push({
      kind: searchKind,
      id: artifact.id,
      title: artifact.title,
      tree,
      text,
      href,
    });
  }
}

function pushFeatureEntries(tree: TreeId, snapshot: ReturnType<typeof loadTreeSnapshot>, entries: SearchCorpusEntry[]): void {
  const features = loadFeaturesForTree(tree, snapshot, "error" in snapshot ? snapshot.error : null);

  const prdTexts = new Map<string, string>();
  for (const artifact of snapshot.artifacts) {
    if (artifact.artifactKind !== "prd" || !artifact.sourcePath.endsWith(".md")) {
      continue;
    }
    const resolved = resolveArtifactPath(tree, artifact.sourcePath);
    if (!resolved.ok || resolved.isDirectory) {
      continue;
    }
    const text = readTextFile(resolved.path, artifact.sourcePath);
    if (text) {
      prdTexts.set(artifact.sourcePath, text);
    }
  }

  for (const feature of features) {
    const prdMarkdown = prdTexts.get(feature.sourcePath) ?? "";
    const sectionSlice = extractSectionAroundFeature(prdMarkdown, feature.id);
    const text = [feature.id, feature.name, sectionSlice].filter(Boolean).join("\n");

    entries.push({
      kind: "feature",
      id: feature.id,
      title: feature.name,
      tree,
      text,
      href: `${docsHref(tree, feature.sourcePath)}#${feature.headingSlug}`,
    });
  }
}

/** Build searchable corpus for all Current BMAD Trees (layout payload). */
export function loadSearchCorpus(trees: TreeId[]): SearchCorpusEntry[] {
  const entries: SearchCorpusEntry[] = [];

  for (const tree of trees) {
    const snapshot = loadTreeSnapshot(tree);
    pushArtifactEntries(tree, snapshot, entries);
    pushFeatureEntries(tree, snapshot, entries);
  }

  return entries;
}
