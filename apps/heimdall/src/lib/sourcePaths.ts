/**
 * Resolve deferred / question "source" tokens to browse paths or in-app routes.
 * Sources are often semicolon-separated (e.g. "Q-133; FR-882; stage-26; F-23").
 */

import { featuresHref } from "./featuresLocation";

export type ResolvedSource =
  { kind: "browse"; path: string; hash?: string; label: string } | { kind: "route"; to: string; label: string } | { kind: "plain"; label: string };

const EXT_DOC = "docs/planning/architecture/EXTERNAL-MODULE-REFERENCE.md";
const INTAKE_DOC = "docs/requirements/INTAKE-INDEX.md";
const FEATURE_DOC = "docs/requirements/FEATURE-REGISTRY.md";
const DEFERRED_DOC = "docs/requirements/DEFERRED-INDEX.md";
const TEST_STRATEGY = "docs/planning/architecture/TEST-STRATEGY.md";
const EPICS_DOC = "docs/planning/epics/epics.md";
const C1_EPICS_DOC = "_bmad-output/planning-artifacts/sample-mode-c1-2026-08-13/epics.md";
const SWE_EPICS_DOC = "_bmad-output/planning-artifacts/sample-world-expansion-2026-08-21/epics.md";

const KNOWN_MD: Record<string, string> = {
  "test-strategy.md": TEST_STRATEGY,
  "deferred-work.md": "docs/implementation/deferred-work.md",
  "notification-dispatch": "docs/planning/architecture/NOTIFICATION-DISPATCH.md",
  "deferred-index.md": DEFERRED_DOC,
  "intake-index.md": INTAKE_DOC,
  "feature-registry.md": FEATURE_DOC,
  "external-module-reference.md": EXT_DOC,
  "epics.md": EPICS_DOC,
  "sample-mode-c1-epics.md": C1_EPICS_DOC,
  "sample-world-expansion-epics.md": SWE_EPICS_DOC,
};

export function browsePath(path: string, hash?: string): string {
  const base = `/browse?path=${encodeURIComponent(path)}`;
  return hash ? `${base}#${encodeURIComponent(hash)}` : base;
}

export function extGapBrowsePath(extId: string): string {
  return browsePath(EXT_DOC, extId.toUpperCase());
}

export function storyRoute(storyId: string): string {
  return `/stories/${storyId}`;
}

export function epicRoute(epicIdOrNumber: string | number): string {
  if (typeof epicIdOrNumber === "number") return `/epics/epic-${epicIdOrNumber}`;
  if (epicIdOrNumber.startsWith("epic-")) return `/epics/${epicIdOrNumber}`;
  return `/epics/epic-${epicIdOrNumber}`;
}

export function featureRoute(featureId: string, search = ""): string {
  // Prefer featuresHref(featureId, location.search) at call sites that have the current URL.
  return featuresHref(featureId, search);
}

/** Parse a single token like "Q-133", "EXT-17", "Story 9.4", "F-23", "stage-26". */
export function resolveSourceToken(token: string): ResolvedSource {
  const t = token.trim();
  if (!t) return { kind: "plain", label: token };

  const qMatch = t.match(/^Q-(\d+)/i);
  if (qMatch) {
    return { kind: "browse", path: INTAKE_DOC, hash: `Q-${qMatch[1]}`, label: t };
  }

  const extMatch = t.match(/^(EXT-\d+)/i);
  if (extMatch) {
    const id = extMatch[1].toUpperCase();
    return { kind: "browse", path: EXT_DOC, hash: id, label: id };
  }

  const storyMatch = t.match(/^Story\s+(\d+)\.(\d+)/i);
  if (storyMatch) {
    const id = `${storyMatch[1]}-${storyMatch[2]}`;
    return { kind: "route", to: storyRoute(id), label: `${storyMatch[1]}.${storyMatch[2]}` };
  }

  const featureMatch = t.match(/^(F-\d+)/i);
  if (featureMatch) {
    const id = featureMatch[1].toUpperCase();
    return { kind: "route", to: featureRoute(id), label: id };
  }

  const frMatch = t.match(/^(FR-\d+)/i);
  if (frMatch) {
    return { kind: "browse", path: EPICS_DOC, label: frMatch[1].toUpperCase() };
  }

  const stageMatch = t.match(/^stage-(\d+)/i);
  if (stageMatch) {
    return {
      kind: "browse",
      path: INTAKE_DOC,
      label: `stage-${stageMatch[1]}`,
    };
  }

  const dfMatch = t.match(/^(DF-\d+)/i);
  if (dfMatch) {
    return {
      kind: "browse",
      path: "docs/requirements/DESIGN-FEEDBACK.md",
      hash: dfMatch[1].toUpperCase(),
      label: dfMatch[1].toUpperCase(),
    };
  }

  const mdMatch = t.match(/([A-Za-z0-9._-]+\.md)/i);
  if (mdMatch) {
    const key = mdMatch[1].toLowerCase();
    const known = KNOWN_MD[key];
    if (known) return { kind: "browse", path: known, label: mdMatch[1] };
    if (key.includes("deferred")) return { kind: "browse", path: DEFERRED_DOC, label: mdMatch[1] };
  }

  for (const [key, path] of Object.entries(KNOWN_MD)) {
    if (t.toLowerCase().includes(key.replace(".md", ""))) {
      return { kind: "browse", path, label: t };
    }
  }

  return { kind: "plain", label: t };
}

/** Split a source cell into linked tokens. */
export function resolveSourceField(source: string): ResolvedSource[] {
  if (!source.trim()) return [];
  const parts = source
    .split(/[;|/]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return [{ kind: "plain", label: source }];
  return parts.map(resolveSourceToken);
}

export function resolvedToHref(r: ResolvedSource): string | null {
  if (r.kind === "route") return r.to;
  if (r.kind === "browse") return browsePath(r.path, r.hash);
  return null;
}
