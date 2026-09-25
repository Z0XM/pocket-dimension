import { error, json } from "@sveltejs/kit";
import {
  DEFAULT_PAGE_SIZE,
  dismissCluster,
  executeDeleteOthers,
  executeMerge,
  listDuplicateSuggestionsPage,
  previewMerge,
  summarizeDuplicates,
  undismissCluster,
  type MergeStrategy,
  type DuplicateTier,
} from "$lib/duplicates/service";
import type { RequestHandler } from "./$types";

function requireAdmin(locals: App.Locals) {
  if (!locals.user) {
    throw error(401, { message: "Authentication required" });
  }
  if (locals.user.role !== "admin") {
    throw error(403, { message: "Admin role required" });
  }
  return locals.user;
}

const STRATEGIES = new Set<MergeStrategy>(["prefer_kept", "prefer_highest", "prefer_recent"]);

export const GET: RequestHandler = async ({ locals, url }) => {
  requireAdmin(locals);
  const view = url.searchParams.get("view") || "page";
  const tier = (url.searchParams.get("tier") || "all") as DuplicateTier | "all";
  const includeDismissed = url.searchParams.get("includeDismissed") === "1";
  const fuzzyThreshold = url.searchParams.get("fuzzyThreshold");
  const includeFuzzy = url.searchParams.get("includeFuzzy") === "1";

  if (view === "summary") {
    const summary = await summarizeDuplicates({
      includeDismissed,
      includeFuzzy,
      fuzzyThreshold: fuzzyThreshold ? Number(fuzzyThreshold) : undefined,
    });
    return json({ summary });
  }

  const limit = Number(url.searchParams.get("limit") || DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE;
  const offset = Number(url.searchParams.get("offset") || 0) || 0;

  const result = await listDuplicateSuggestionsPage({
    tier,
    includeDismissed,
    fuzzyThreshold: fuzzyThreshold ? Number(fuzzyThreshold) : undefined,
    limit,
    offset,
  });

  return json(result);
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const user = requireAdmin(locals);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "");

  try {
    if (action === "preview") {
      const keepId = String(body.keepId || "");
      const mergeIds = Array.isArray(body.mergeIds) ? body.mergeIds.map(String) : [];
      const strategy = String(body.strategy || "prefer_highest") as MergeStrategy;
      if (!STRATEGIES.has(strategy)) {
        return json({ error: `Invalid strategy: ${strategy}` }, { status: 400 });
      }
      const preview = await previewMerge({ keepId, mergeIds, strategy });
      return json({ ok: true, preview });
    }

    if (action === "merge") {
      const keepId = String(body.keepId || "");
      const mergeIds = Array.isArray(body.mergeIds) ? body.mergeIds.map(String) : [];
      const strategy = String(body.strategy || "prefer_highest") as MergeStrategy;
      if (!STRATEGIES.has(strategy)) {
        return json({ error: `Invalid strategy: ${strategy}` }, { status: 400 });
      }
      const result = await executeMerge({ keepId, mergeIds, strategy, adminUserId: user.id });
      return json(result);
    }

    if (action === "delete_others") {
      const keepId = String(body.keepId || "");
      const deleteIds = Array.isArray(body.deleteIds) ? body.deleteIds.map(String) : [];
      const result = await executeDeleteOthers({ keepId, deleteIds, adminUserId: user.id });
      return json(result);
    }

    if (action === "dismiss") {
      const fingerprint = String(body.fingerprint || "");
      const itemIds = Array.isArray(body.itemIds) ? body.itemIds.map(String) : [];
      const tier = String(body.tier || "direct") as DuplicateTier;
      const reason = body.reason == null ? null : String(body.reason);
      if (!fingerprint && itemIds.length < 2) {
        return json({ error: "fingerprint or itemIds required" }, { status: 400 });
      }
      const result = await dismissCluster({
        fingerprint,
        itemIds,
        tier,
        reason,
        adminUserId: user.id,
      });
      return json(result);
    }

    if (action === "undismiss") {
      const fingerprint = String(body.fingerprint || "");
      if (!fingerprint) return json({ error: "fingerprint required" }, { status: 400 });
      const result = await undismissCluster(fingerprint);
      return json(result);
    }

    return json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return json({ ok: false, error: err?.message || "Request failed" }, { status: 400 });
  }
};
