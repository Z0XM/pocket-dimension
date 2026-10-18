import { db, schema } from "@pocket-dimension/db";
import { and, count, eq, gte, isNotNull, sql } from "drizzle-orm";
import { isUuid } from "$lib/admin-access";
import { listZapUsers, requireZapAdmin } from "$lib/server/admin/access";
import { listAdminActivity } from "$lib/server/admin/activity";
import { parseAdminActivityKind, parseBeforeCursor } from "$lib/server/admin/activity-merge";
import type { PageServerLoad } from "./$types";

async function loadSummary() {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [[users], [songs], [liveSessions]] = await Promise.all([
    db
      .select({
        seen: count(schema.userAccess.lastSeenAt),
        day: sql<number>`count(*) filter (where ${gte(schema.userAccess.lastSeenAt, dayAgo)})::int`,
        week: sql<number>`count(*) filter (where ${gte(schema.userAccess.lastSeenAt, weekAgo)})::int`,
        blocked: sql<number>`count(*) filter (where ${eq(schema.userAccess.status, "blocked")})::int`,
        admins: sql<number>`count(*) filter (where ${schema.userAccess.isAdmin})::int`,
      })
      .from(schema.userAccess),
    db
      .select({
        total: count(),
        stored: sql<number>`count(*) filter (where ${isNotNull(schema.mediaAssets.storageKey)})::int`,
      })
      .from(schema.mediaAssets),
    db
      .select({ total: count() })
      .from(schema.sessions)
      .where(and(eq(schema.sessions.status, "live"))),
  ]);
  return {
    usersSeen: users?.seen ?? 0,
    activeDay: users?.day ?? 0,
    activeWeek: users?.week ?? 0,
    blocked: users?.blocked ?? 0,
    admins: users?.admins ?? 0,
    songs: songs?.total ?? 0,
    storedSongs: songs?.stored ?? 0,
    liveSessions: liveSessions?.total ?? 0,
  };
}

export const load: PageServerLoad = async ({ locals, url }) => {
  requireZapAdmin(locals);
  const userParam = url.searchParams.get("user");
  const userId = isUuid(userParam) ? userParam : null;
  const kind = parseAdminActivityKind(url.searchParams.get("kind"));
  const before = parseBeforeCursor(url.searchParams.get("before"));

  const mode = locals.zapAccess!.mode;
  const [summary, activity, users] = await Promise.all([loadSummary(), listAdminActivity({ userId, kind, before, limit: 100 }), listZapUsers(mode)]);

  return {
    summary,
    activity: activity.entries,
    nextBefore: activity.nextBefore,
    filters: { userId: userId ?? "", kind: kind ?? "", before: before?.toISOString() ?? "" },
    users: users.map((u) => ({ userId: u.userId, label: u.username ?? u.email, lastSeenAt: u.lastSeenAt })),
  };
};
