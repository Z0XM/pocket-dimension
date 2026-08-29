/**
 * Product-facing areas for the Features tab.
 *
 * Feature Registry `- **Area:**` is authoritative. Freeform values become a
 * stable slug id + display label. Missing Area → `other`.
 */

export type ResolvedArea = {
  id: string;
  label: string;
};

/** Stable slug for freeform FR Area text. */
export function slugifyArea(raw: string): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "other";
}

export function resolveFeatureArea(_featureId: string, areaFromDetail?: string): ResolvedArea {
  if (typeof areaFromDetail === "string") {
    const raw = areaFromDetail.trim();
    if (!raw) {
      return { id: "other", label: "Other" };
    }
    return { id: slugifyArea(raw), label: raw };
  }

  return { id: "other", label: "Other" };
}

export function resolveFeatureAreaId(featureId: string, areaFromDetail?: string): string {
  return resolveFeatureArea(featureId, areaFromDetail).id;
}

export function areaLabel(areaId: string): string {
  return areaId === "other" ? "Other" : areaId;
}

export function areaDescription(_areaId: string): string {
  return "";
}

/** Stable group label: lexicographically first candidate, else id. */
export function displayAreaLabel(areaId: string, candidates: Iterable<string>): string {
  const unique = [...new Set([...candidates].map((c) => c.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return unique[0] ?? (areaId === "other" ? "Other" : areaId);
}

/** Stable UI order: alpha by id, `other` last. */
export function sortAreaIds(ids: Iterable<string>): string[] {
  return [...ids].sort((a, b) => {
    if (a === "other" && b !== "other") return 1;
    if (b === "other" && a !== "other") return -1;
    return a.localeCompare(b);
  });
}
