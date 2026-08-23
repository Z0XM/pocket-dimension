import type { ArtifactKind } from "$lib/types";

const STORY_BASENAME = /^\d+-\d+-/;
const ARCHITECTURE_BASENAME = /^architecture(\.|-|$)/i;

/** Path/filename-first classifier; optional content heuristics when still unmatched. */
export function classifyArtifact(relativePath: string, contentHint?: string): ArtifactKind {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const basename = normalized.split("/").pop() ?? normalized;
  const basenameLower = basename.toLowerCase();

  // 1 — Epic
  if (basenameLower === "epics.md" || /^epics-.*\.md$/i.test(basename) || basenameLower.includes("-epic-") || normalized.endsWith("/epics.md")) {
    return "epic";
  }

  // 2 — Story (implementation-artifacts + N-N- prefix)
  if (normalized.includes("implementation-artifacts/") && STORY_BASENAME.test(basename)) {
    return "story";
  }

  // 3 — PRD
  if (normalized.split("/").includes("prds") || basenameLower === "prd.md" || /^prd-.*\.md$/i.test(basename)) {
    return "prd";
  }

  // 4 — UX
  if (normalized.includes("ux-designs/") || basenameLower === "design.md" || basenameLower === "experience.md") {
    return "ux";
  }

  // 5 — Architecture
  if (ARCHITECTURE_BASENAME.test(basename)) {
    return "architecture";
  }

  // 6 — Doc (brownfield / planning leftovers)
  if (isDocPath(normalized, basename, basenameLower)) {
    return "doc";
  }

  // 7 — Content heuristics (narrow; only when hint provided)
  if (contentHint) {
    const heuristic = classifyFromContent(contentHint);
    if (heuristic) {
      return heuristic;
    }
  }

  // 8 — Unclassified
  return "unclassified";
}

function isDocPath(normalized: string, basename: string, basenameLower: string): boolean {
  const docBasenames = new Set(["project-context.md", "project-overview.md", "index.md", "addendum.md"]);

  if (docBasenames.has(basenameLower)) {
    return true;
  }

  if (/-guide\.md$/i.test(basename)) {
    return true;
  }

  const docPrefixes = [
    "api-contracts",
    "data-models",
    "component-inventory",
    "source-tree",
    "contribution",
    "deployment",
    "development-guide",
    "deferred-work",
    "reconcile-",
    "review-rubric",
    "product-brief",
    "implementation-readiness",
    "sprint-status",
  ];

  for (const prefix of docPrefixes) {
    if (basenameLower.startsWith(prefix)) {
      return true;
    }
  }

  // Decision logs under planning when not already matched above
  if (normalized.includes("planning-artifacts/") && basenameLower === ".decision-log.md") {
    return true;
  }

  return false;
}

function classifyFromContent(contentHint: string): ArtifactKind | null {
  const head = contentHint.slice(0, 4096);

  if (/^#\s+Story\b/m.test(head) || /^##\s+Acceptance Criteria/m.test(head) || /^Status:/m.test(head)) {
    return "story";
  }

  if (/^#\s+Epic\b/m.test(head) || /^###\s+Story/m.test(head)) {
    return "epic";
  }

  if (/^#\s+PRD\b/m.test(head)) {
    return "prd";
  }

  return null;
}
