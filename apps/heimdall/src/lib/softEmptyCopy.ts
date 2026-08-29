export type SoftEmptyKind = "feature-registry" | "optional-intake" | "optional-deferred" | "optional-external" | "delivery-epics" | "planning";

export interface SoftEmptyCopy {
  title: string;
  description: string;
}

const DOCTOR_HINT = "Run heimdall doctor for path and parser guidance under your Module Scope and configured BMAD paths.";

const COPY: Record<SoftEmptyKind, SoftEmptyCopy> = {
  "feature-registry": {
    title: "No feature registry for current Module Scope",
    description: `No feature registry is configured or populated for the selected Module Scope — a process gap, not a load failure. ${DOCTOR_HINT}`,
  },
  "optional-intake": {
    title: "Optional intake not configured",
    description: `Open questions come from an optional INTAKE-INDEX under your Module Scope. When none is configured, this board stays empty — not a load failure. ${DOCTOR_HINT}`,
  },
  "optional-deferred": {
    title: "Optional deferred index not configured",
    description: `Deferred items come from an optional DEFERRED-INDEX under your Module Scope. When none is configured, this board stays empty — not a load failure. ${DOCTOR_HINT}`,
  },
  "optional-external": {
    title: "Optional external gaps not configured",
    description: `Blocked stories and external gaps appear when optional indexes are configured under your Module Scope. An empty board is normal when those indexes are absent. ${DOCTOR_HINT}`,
  },
  "delivery-epics": {
    title: "No epics or stories for current Module Scope",
    description: `Epics and stories appear when planning artifacts match configured parser paths under your Module Scope. ${DOCTOR_HINT}`,
  },
  planning: {
    title: "No planning artifacts for current Module Scope",
    description: `Overview metrics need epics or stories from configured BMAD paths under your Module Scope. ${DOCTOR_HINT}`,
  },
};

export function getSoftEmptyCopy(kind: SoftEmptyKind): SoftEmptyCopy {
  return COPY[kind];
}

/** Docs board empty copy (inline on DocsPage — not a SoftEmptyKind banner). */
export function getDocsEmptyBoardCopy(): SoftEmptyCopy {
  return {
    title: "No docs indexed under configured roots",
    description: "No markdown files are indexed under paths.docsRoot or docs.extraRoots. Check configured doc roots and run heimdall doctor.",
  };
}

/** Show Module label chip only in All modules view when label is present (FR-14, UX-DR5). */
export function showModuleLabelChip(moduleScope: string, moduleLabel: string | undefined | null): boolean {
  return moduleScope === "all" && Boolean(moduleLabel);
}

/** Matches server isBridgeEpic — Bridge / Historical title prefix (FR-15). */
export function isBridgeTitle(title: string): boolean {
  return /\bBridge:|\bHistorical:/.test(title);
}
