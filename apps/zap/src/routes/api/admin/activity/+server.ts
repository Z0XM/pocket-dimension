import { error, json } from "@sveltejs/kit";
import { isUuid } from "$lib/admin-access";
import { requireZapAdmin } from "$lib/server/admin/access";
import { listAdminActivity } from "$lib/server/admin/activity";
import { parseAdminActivityKind, parseBeforeCursor } from "$lib/server/admin/activity-merge";
import type { RequestHandler } from "./$types";

const PAGE_SIZE = 100;

/** Zap admin: paginated cross-user activity feed. */
export const GET: RequestHandler = async ({ locals, url }) => {
  requireZapAdmin(locals);

  const userParam = url.searchParams.get("user");
  const userId = isUuid(userParam) ? userParam : null;
  const kind = parseAdminActivityKind(url.searchParams.get("kind"));
  const before = parseBeforeCursor(url.searchParams.get("before"));
  const limitRaw = Number(url.searchParams.get("limit") ?? String(PAGE_SIZE));
  const limit = Number.isFinite(limitRaw) ? limitRaw : PAGE_SIZE;

  const activity = await listAdminActivity({ userId, kind, before, limit });

  return json({
    entries: activity.entries,
    nextBefore: activity.nextBefore,
    hasMore: Boolean(activity.nextBefore),
  });
};
