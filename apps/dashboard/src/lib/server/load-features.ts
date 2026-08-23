import { extractFeatures } from "$lib/catalog/features";
import { resolveArtifactPath } from "$lib/server/read-artifact";
import type { FeatureRow, LayoutTreeData, TreeId } from "$lib/types";
import { readFileSync } from "node:fs";

export function loadFeaturesForTree(tree: TreeId | null, snapshot: LayoutTreeData["snapshot"], snapshotError?: string | null): FeatureRow[] {
  if (!tree || !snapshot || snapshotError) {
    return [];
  }

  const prdMarkdown = snapshot.artifacts
    .filter((artifact) => artifact.artifactKind === "prd" && artifact.sourcePath.endsWith(".md"))
    .sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));

  const features: FeatureRow[] = [];

  for (const artifact of prdMarkdown) {
    const resolved = resolveArtifactPath(tree, artifact.sourcePath);
    if (!resolved.ok) {
      console.warn(`load-features: ${artifact.sourcePath}: ${resolved.reason}`);
      continue;
    }

    if (resolved.isDirectory) {
      continue;
    }

    try {
      const markdown = readFileSync(resolved.path, "utf8");
      features.push(
        ...extractFeatures(markdown, {
          sourcePath: artifact.sourcePath,
          sourceTitle: artifact.title,
        })
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Could not read file.";
      console.warn(`load-features: ${artifact.sourcePath}: ${reason}`);
    }
  }

  return features;
}
