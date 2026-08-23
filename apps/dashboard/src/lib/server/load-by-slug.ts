import { loadArtifact } from "$lib/server/read-artifact";
import { loadTreeSnapshot } from "$lib/server/read-tree";
import type { ArtifactPageData, ArtifactRef, TreeId } from "$lib/types";

export type LoadBySlugResult = { ok: true; artifact: ArtifactPageData; ref: ArtifactRef } | { ok: false; reason: string; sourcePath: string };

export function findArtifactBySlug(
  tree: TreeId,
  id: string,
  expectedKind: "epic" | "story",
  bmadRoot?: string
): { ok: true; ref: ArtifactRef } | { ok: false; reason: string } {
  const snapshot = loadTreeSnapshot(tree, bmadRoot);
  const ref = snapshot.artifacts.find((artifact) => artifact.id === id);

  if (!ref) {
    return { ok: false, reason: "Artifact not found." };
  }

  if (ref.artifactKind !== expectedKind) {
    return { ok: false, reason: `Expected ${expectedKind} artifact; found ${ref.artifactKind}.` };
  }

  return { ok: true, ref };
}

export function loadArtifactBySlug(tree: TreeId, id: string, expectedKind: "epic" | "story", bmadRoot?: string): LoadBySlugResult {
  const found = findArtifactBySlug(tree, id, expectedKind, bmadRoot);
  if (!found.ok) {
    return { ok: false, reason: found.reason, sourcePath: id };
  }

  const artifact = loadArtifact(tree, found.ref.sourcePath, bmadRoot);
  return { ok: true, artifact, ref: found.ref };
}
