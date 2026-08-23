import { parseSprintStatusYaml, projectDelivery } from "$lib/catalog/delivery";
import type { DeliveryItem } from "$lib/catalog/delivery";
import { resolveArtifactPath } from "$lib/server/read-artifact";
import type { ArtifactRef, LayoutTreeData, TreeId } from "$lib/types";
import { readFileSync } from "node:fs";

const SPRINT_STATUS_BASENAME = "sprint-status.yaml";

export function loadDeliveryForTree(tree: TreeId | null, snapshot: LayoutTreeData["snapshot"], snapshotError?: string | null): DeliveryItem[] {
  if (!tree || !snapshot || snapshotError) {
    return [];
  }

  const sprintMap = loadSprintStatusMap(tree, snapshot.artifacts);
  return projectDelivery(snapshot.artifacts, sprintMap);
}

function loadSprintStatusMap(tree: TreeId, artifacts: ArtifactRef[]): Map<string, string> | null {
  const sprintArtifact = artifacts.find((artifact) => basename(artifact.sourcePath) === SPRINT_STATUS_BASENAME);
  if (!sprintArtifact) {
    return null;
  }

  const resolved = resolveArtifactPath(tree, sprintArtifact.sourcePath);
  if (!resolved.ok || resolved.isDirectory) {
    console.warn(`load-delivery: ${sprintArtifact.sourcePath}: ${resolved.ok ? "is a directory" : resolved.reason}`);
    return null;
  }

  try {
    const text = readFileSync(resolved.path, "utf8");
    return parseSprintStatusYaml(text);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Could not read sprint-status.yaml.";
    console.warn(`load-delivery: ${sprintArtifact.sourcePath}: ${reason}`);
    return null;
  }
}

function basename(sourcePath: string): string {
  return sourcePath.split("/").pop() ?? sourcePath;
}
