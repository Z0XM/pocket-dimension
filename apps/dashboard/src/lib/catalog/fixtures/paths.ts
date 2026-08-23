/** Golden relative paths mirroring pocket-dimension / zeo / chhan-chhan conventions. */
export const EPIC_PATHS = [
  "planning-artifacts/epics.md",
  "planning-artifacts/epics-dashboard.md",
  "implementation-artifacts/9-epic-remove-guest-mode.md",
  "implementation-artifacts/10-epic-game-shell-sse.md",
] as const;

export const STORY_PATHS = [
  "implementation-artifacts/2-1-browse-docs-grouped-by-artifact-kind.md",
  "implementation-artifacts/1-2-show-quiet-dark-chrome-that-does-not-compete-with-content.md",
  "implementation-artifacts/7-2-device-picker.md",
] as const;

export const PRD_PATHS = ["planning-artifacts/prds/prd-dashboard-2026-08-23/prd.md", "planning-artifacts/prds/prd-zeo-2026-06-27/prd.md"] as const;

export const UX_PATHS = [
  "planning-artifacts/ux-designs/ux-dashboard-2026-08-23/DESIGN.md",
  "planning-artifacts/ux-designs/ux-dashboard-2026-08-23/EXPERIENCE.md",
] as const;

export const ARCHITECTURE_PATHS = [
  "planning-artifacts/architecture.md",
  "planning-artifacts/architecture-dashboard.md",
  "planning-artifacts/architecture-game-mode.md",
  "architecture-watchlist.md",
] as const;

export const DOC_PATHS = [
  "project-context.md",
  "project-overview.md",
  "index.md",
  "development-guide.md",
  "deployment-guide.md",
  "contribution-guide.md",
  "deferred-work.md",
  "planning-artifacts/implementation-readiness-report-2026-08-23.md",
  "implementation-artifacts/sprint-status-dashboard.yaml",
  "api-contracts-zeo.md",
  "data-models.md",
  "component-inventory-rhymes.md",
  "source-tree-analysis.md",
] as const;

export const UNCLASSIFIED_PATHS = [
  "planning-artifacts/specs/spec-shared-listening/SPEC.md",
  "implementation-artifacts/investigations/mic-unmute-reconnect-investigation.md",
  "implementation-artifacts/design-updates-2026-06-27.md",
  "some-random-notes.md",
] as const;

/** Feature-like names must NOT become a Kind — they stay unclassified or doc/epic per path rules. */
export const FEATURE_LIKE_PATHS = ["planning-artifacts/features-list.md", "implementation-artifacts/feature-toggle-notes.md"] as const;

export const HEURISTIC_SNIPPETS = {
  story: "# Story 2.1: Browse Docs\n\n## Acceptance Criteria\n\n1. Given...",
  epic: "# Epic 3: Delivery\n\n### Story 3.1",
  prd: "# PRD: Dashboard\n\n## Goals",
} as const;
