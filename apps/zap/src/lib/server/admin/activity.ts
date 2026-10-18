import { db, schema } from "@pocket-dimension/db";
import { and, desc, eq, inArray, lt, type SQL } from "drizzle-orm";
import { parseSyncSummary, playlistLabel } from "$lib/server/activity";
import { mergeActivity, type AdminActivityEntry, type AdminActivityKind } from "./activity-merge";

export type AdminActivityQuery = {
  userId?: string | null;
  kind?: AdminActivityKind | null;
  before?: Date | null;
  limit?: number;
};

function where(...conditions: (SQL | undefined)[]) {
  const list = conditions.filter((c): c is SQL => Boolean(c));
  return list.length ? and(...list) : undefined;
}

/** Cross-user Zap activity (plays, sessions, joins, imports, uploads), newest first. */
export async function listAdminActivity(input: AdminActivityQuery = {}) {
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 300);
  const wants = (kind: AdminActivityKind) => !input.kind || input.kind === kind;
  const before = input.before ?? null;
  const userId = input.userId ?? null;

  const [plays, hosted, joins, runs, uploads] = await Promise.all([
    wants("play")
      ? db
          .select({ event: schema.playEvents, title: schema.mediaAssets.title, artists: schema.mediaAssets.artists })
          .from(schema.playEvents)
          .innerJoin(schema.mediaAssets, eq(schema.mediaAssets.id, schema.playEvents.mediaAssetId))
          .where(where(userId ? eq(schema.playEvents.userId, userId) : undefined, before ? lt(schema.playEvents.playedAt, before) : undefined))
          .orderBy(desc(schema.playEvents.playedAt))
          .limit(limit)
      : [],
    wants("session_started")
      ? db.query.sessions.findMany({
          where: where(userId ? eq(schema.sessions.hostUserId, userId) : undefined, before ? lt(schema.sessions.createdAt, before) : undefined),
          orderBy: [desc(schema.sessions.createdAt)],
          limit,
        })
      : [],
    wants("session_joined")
      ? db.query.sessionMembers.findMany({
          where: where(
            eq(schema.sessionMembers.role, "guest"),
            userId ? eq(schema.sessionMembers.userId, userId) : undefined,
            before ? lt(schema.sessionMembers.joinedAt, before) : undefined
          ),
          orderBy: [desc(schema.sessionMembers.joinedAt)],
          limit,
        })
      : [],
    wants("import")
      ? db.query.syncRuns.findMany({
          where: where(userId ? eq(schema.syncRuns.userId, userId) : undefined, before ? lt(schema.syncRuns.createdAt, before) : undefined),
          orderBy: [desc(schema.syncRuns.createdAt)],
          limit,
        })
      : [],
    wants("upload")
      ? db.query.mediaAssets.findMany({
          where: where(
            eq(schema.mediaAssets.sourceType, "upload"),
            userId ? eq(schema.mediaAssets.addedByUserId, userId) : undefined,
            before ? lt(schema.mediaAssets.createdAt, before) : undefined
          ),
          orderBy: [desc(schema.mediaAssets.createdAt)],
          limit,
        })
      : [],
  ]);

  const userIds = new Set<string>();
  for (const p of plays) userIds.add(p.event.userId);
  for (const s of hosted) userIds.add(s.hostUserId);
  for (const m of joins) userIds.add(m.userId);
  for (const r of runs) userIds.add(r.userId);
  for (const u of uploads) if (u.addedByUserId) userIds.add(u.addedByUserId);

  const users =
    userIds.size > 0
      ? await db
          .select({ id: schema.user.id, email: schema.user.email, username: schema.user.username })
          .from(schema.user)
          .where(inArray(schema.user.id, [...userIds]))
      : [];
  const labelFor = new Map(users.map((u) => [u.id, u.username?.trim() || u.email]));
  const label = (id: string) => labelFor.get(id) ?? "Deleted account";

  const sessionCodes = new Map(hosted.map((s) => [s.id, s.joinCode]));
  const missingSessionIds = [...new Set(joins.map((j) => j.sessionId).filter((id) => !sessionCodes.has(id)))];
  if (missingSessionIds.length > 0) {
    const rows = await db
      .select({ id: schema.sessions.id, joinCode: schema.sessions.joinCode })
      .from(schema.sessions)
      .where(inArray(schema.sessions.id, missingSessionIds));
    for (const row of rows) sessionCodes.set(row.id, row.joinCode);
  }

  const entries = mergeActivity(
    [
      plays.map(({ event, title, artists }) => ({
        id: `play:${event.id}`,
        kind: "play" as const,
        at: event.playedAt.toISOString(),
        userId: event.userId,
        userLabel: label(event.userId),
        summary: title,
        detail: [artists, event.sessionId ? "in a session" : null].filter(Boolean).join(" · ") || null,
      })),
      hosted.map((s) => ({
        id: `session:${s.id}`,
        kind: "session_started" as const,
        at: s.createdAt.toISOString(),
        userId: s.hostUserId,
        userLabel: label(s.hostUserId),
        summary: `Started session ${s.joinCode}`,
        detail: s.endedAt ? `ended ${s.endedAt.toISOString()}` : s.status === "live" ? "live" : s.status,
      })),
      joins.map((m) => ({
        id: `join:${m.id}`,
        kind: "session_joined" as const,
        at: m.joinedAt.toISOString(),
        userId: m.userId,
        userLabel: label(m.userId),
        summary: `Joined session ${sessionCodes.get(m.sessionId) ?? ""}`.trim(),
        detail: m.leftAt ? `left ${m.leftAt.toISOString()}` : null,
      })),
      runs.map((r) => {
        const meta = playlistLabel(r.sourceUrl, parseSyncSummary(r.summaryJson));
        const counts = [`${r.importedCount} imported`];
        if (r.unavailableCount) counts.push(`${r.unavailableCount} not available`);
        if (r.skippedCount) counts.push(`${r.skippedCount} skipped`);
        if (r.failedCount) counts.push(`${r.failedCount} failed`);
        return {
          id: `sync:${r.id}`,
          kind: "import" as const,
          at: r.createdAt.toISOString(),
          userId: r.userId,
          userLabel: label(r.userId),
          summary: `${meta.kind === "playlist_import" ? "Playlist import" : "URL import"}: ${meta.label}`,
          detail: `${r.status} · ${counts.join(" · ")}`,
        };
      }),
      uploads
        .filter((u) => u.addedByUserId)
        .map((u) => ({
          id: `upload:${u.id}`,
          kind: "upload" as const,
          at: u.createdAt.toISOString(),
          userId: u.addedByUserId!,
          userLabel: label(u.addedByUserId!),
          summary: `Uploaded ${u.title}`,
          detail: u.artists,
        })),
    ] satisfies AdminActivityEntry[][],
    limit
  );

  const last = entries.at(-1);
  return { entries, nextBefore: entries.length === limit && last ? last.at : null };
}
