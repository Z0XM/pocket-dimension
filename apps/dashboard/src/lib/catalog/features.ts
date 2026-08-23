import { slugifyHeading } from "$lib/catalog/heading-slug";
import type { FeatureRow } from "$lib/types";

export type FeatureExtractMeta = {
  sourcePath: string;
  sourceTitle: string;
};

const FR_HEADING_RE = /^(FR-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)\s*:?\s*(.*)$/;
const NUMBERED_FEATURE_RE = /^(\d+\.\d+)\s+(.+)$/;
const FEATURES_SECTION_RE = /^(\d+\.\s+)?Features$/i;
const FUNCTIONAL_REQUIREMENTS_RE = /^Functional Requirements$/i;
const NON_FUNCTIONAL_REQUIREMENTS_RE = /^Non-Functional Requirements$/i;

type Section = "none" | "features" | "functional_requirements" | "skip";

type PendingThematic = {
  text: string;
  slug: string;
  hasFrChild: boolean;
};

function isExcludedThematic(text: string): boolean {
  const trimmed = text.trim();
  if (/^FR-/i.test(trimmed)) {
    return true;
  }
  if (/^NFR-/i.test(trimmed)) {
    return true;
  }
  if (/^UJ-/i.test(trimmed)) {
    return true;
  }
  if (/^G\d+\./.test(trimmed)) {
    return true;
  }
  if (/persona/i.test(trimmed)) {
    return true;
  }
  if (/^Epic\s+\d/i.test(trimmed)) {
    return true;
  }
  if (/^Story\s+\d/i.test(trimmed)) {
    return true;
  }
  return false;
}

function pushFrRow(rows: FeatureRow[], text: string, meta: FeatureExtractMeta): void {
  const match = text.match(FR_HEADING_RE);
  if (!match) {
    return;
  }

  const id = match[1];
  const remainder = match[2]?.trim() ?? "";

  rows.push({
    id,
    name: remainder || id,
    sourcePath: meta.sourcePath,
    sourceTitle: meta.sourceTitle,
    headingSlug: slugifyHeading(text),
    kind: "fr",
  });
}

function pushFeatureRow(rows: FeatureRow[], id: string, name: string, headingText: string, meta: FeatureExtractMeta): void {
  rows.push({
    id,
    name,
    sourcePath: meta.sourcePath,
    sourceTitle: meta.sourceTitle,
    headingSlug: slugifyHeading(headingText),
    kind: "feature",
  });
}

/** Pure extraction of Feature / FR rows from PRD markdown (no fs). */
export function extractFeatures(markdown: string, meta: FeatureExtractMeta): FeatureRow[] {
  const rows: FeatureRow[] = [];
  let section: Section = "none";
  let pendingThematic: PendingThematic | null = null;

  const flushThematic = () => {
    if (pendingThematic?.hasFrChild) {
      pushFeatureRow(rows, pendingThematic.slug, pendingThematic.text, pendingThematic.text, meta);
    }
    pendingThematic = null;
  };

  for (const line of markdown.split(/\r?\n/)) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (!headingMatch) {
      continue;
    }

    const level = headingMatch[1].length;
    const text = headingMatch[2].trim();

    if (level === 2) {
      flushThematic();

      if (FEATURES_SECTION_RE.test(text)) {
        section = "features";
      } else if (FUNCTIONAL_REQUIREMENTS_RE.test(text)) {
        section = "functional_requirements";
      } else if (NON_FUNCTIONAL_REQUIREMENTS_RE.test(text)) {
        section = "skip";
      } else {
        section = "none";
      }
      continue;
    }

    if (section === "skip") {
      continue;
    }

    if (FR_HEADING_RE.test(text)) {
      if (pendingThematic) {
        pendingThematic.hasFrChild = true;
      }
      pushFrRow(rows, text, meta);
      continue;
    }

    if (section === "features" && level === 3) {
      const numbered = text.match(NUMBERED_FEATURE_RE);
      if (numbered) {
        pushFeatureRow(rows, numbered[1], numbered[2].trim(), text, meta);
      }
      continue;
    }

    if (section === "functional_requirements" && level === 3) {
      flushThematic();
      if (!isExcludedThematic(text)) {
        pendingThematic = {
          text,
          slug: slugifyHeading(text),
          hasFrChild: false,
        };
      }
    }
  }

  flushThematic();
  return rows;
}

/** Case-insensitive substring filter on id or name; empty query returns all rows. */
export function filterFeatures(features: FeatureRow[], query: string): FeatureRow[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return features;
  }

  return features.filter((row) => row.id.toLowerCase().includes(needle) || row.name.toLowerCase().includes(needle));
}
