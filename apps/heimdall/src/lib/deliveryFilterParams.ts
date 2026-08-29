import type { StoryStatus } from "@/api/client";

export type DeliveryStatusFilter = "all" | StoryStatus;

export type DeliveryView = "kanban" | "table" | "timeline";

export const DELIVERY_STATUS_PARAM = "status";
export const DELIVERY_SEARCH_PARAM = "q";
export const DELIVERY_VIEW_PARAM = "view";

const STATUS_VALUES = new Set<DeliveryStatusFilter>(["all", "backlog", "ready-for-dev", "in-progress", "review", "blocked", "done"]);

export function parseDeliveryStatusParam(raw: string | null): DeliveryStatusFilter {
  if (raw && STATUS_VALUES.has(raw as DeliveryStatusFilter)) {
    return raw as DeliveryStatusFilter;
  }
  return "all";
}

export function parseDeliverySearchParam(raw: string | null): string {
  return raw ?? "";
}

export function parseDeliveryViewParam(raw: string | null): DeliveryView {
  if (raw === "table" || raw === "timeline" || raw === "kanban") return raw;
  return "kanban";
}

export function applyDeliveryFilterParams(params: URLSearchParams, next: { status?: DeliveryStatusFilter; q?: string }): URLSearchParams {
  const out = new URLSearchParams(params);
  if (next.status !== undefined) {
    if (next.status === "all") out.delete(DELIVERY_STATUS_PARAM);
    else out.set(DELIVERY_STATUS_PARAM, next.status);
  }
  if (next.q !== undefined) {
    const q = next.q.trim();
    if (!q) out.delete(DELIVERY_SEARCH_PARAM);
    else out.set(DELIVERY_SEARCH_PARAM, q);
  }
  return out;
}
