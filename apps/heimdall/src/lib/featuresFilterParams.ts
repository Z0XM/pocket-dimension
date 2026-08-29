import type { FeatureStatusFilter } from "@/lib/featureStatus";

export const FEATURE_STATUS_PARAM = "status";
export const FEATURE_SEARCH_PARAM = "q";

const STATUS_VALUES = new Set<FeatureStatusFilter>(["all", "complete", "in-progress", "blocked", "confirmed", "pending", "deferred"]);

export function parseFeatureStatusParam(raw: string | null): FeatureStatusFilter {
  if (raw && STATUS_VALUES.has(raw as FeatureStatusFilter)) {
    return raw as FeatureStatusFilter;
  }
  return "all";
}

export function parseFeatureSearchParam(raw: string | null): string {
  return raw ?? "";
}

export function applyFeatureFilterParams(params: URLSearchParams, next: { status?: FeatureStatusFilter; q?: string }): URLSearchParams {
  const out = new URLSearchParams(params);
  if (next.status !== undefined) {
    if (next.status === "all") out.delete(FEATURE_STATUS_PARAM);
    else out.set(FEATURE_STATUS_PARAM, next.status);
  }
  if (next.q !== undefined) {
    const q = next.q.trim();
    if (!q) out.delete(FEATURE_SEARCH_PARAM);
    else out.set(FEATURE_SEARCH_PARAM, q);
  }
  return out;
}
