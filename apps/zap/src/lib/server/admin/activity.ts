import { db, schema } from "@pocket-dimension/db";
import { and, desc, eq, inArray, lt, type SQL } from "drizzle-orm";
import { parseSyncSummary, playlistLabel } from "$lib/server/activity";
import { mergeActivity, type AdminActivityEntry, type AdminActivityKind, type AdminActivityLink } from "./activity-merge";

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

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function playHref(externalUrl: string | null, title: string, mediaAssetId: string): string {
  if (externalUrl && isHttpUrl(externalUrl)) return externalUrl;
  const q = title.trim() || mediaAssetId;
  return `/catalogue?q=${encodeURIComponent(q)}`;
}

function youtubePlaylistHref(playlistId: string): string {
  return `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
}

function importLinks(sourceUrl: string, summary: ReturnType<typeof parseSyncSummary>, meta: ReturnType<typeof playlistLabel>): AdminActivityLink[] {
  if (meta.kind === "url_import") {
    return isHttpUrl(sourceUrl) ? [{ label: sourceUrl, href: sourceUrl }] : [];
  }

  const ids = sourceUrl.startsWith("youtube:connected:")
    ? sourceUrl
        .slice("youtube:connected:".length)
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : [];

  const titlesFromSummary =
    summary?.playlistTitles ??
    (Array.isArray(summary?.playlists) ? summary.playlists.map((p) => (typeof p === "string" ? p : p.title)).filter(Boolean) : []);

  if (ids.length === 0) return [];

  return ids.map((id, index) => ({
    label: titlesFromSummary[index] || id,
    href: youtubePlaylistHref(id),
  }));
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
          .select({
            event: schema.playEvents,
            title: schema.mediaAssets.title,
            artists: schema.mediaAssets.artists,
            externalUrl: schema.mediaAssets.externalUrl,
            mediaAssetId: schema.mediaAssets.id,
          })
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
      plays.map(({ event, title, artists, externalUrl, mediaAssetId }) => ({
        id: `play:${event.id}`,
        kind: "play" as const,
        at: event.playedAt.toISOString(),
        userId: event.userId,
        userLabel: label(event.userId),
        summary: title,
        detail: [artists, event.sessionId ? "in a session" : null].filter(Boolean).join(" · ") || null,
        href: playHref(externalUrl, title, mediaAssetId),
        links: null,
      })),
      hosted.map((s) => ({
        id: `session:${s.id}`,
        kind: "session_started" as const,
        at: s.createdAt.toISOString(),
        userId: s.hostUserId,
        userLabel: label(s.hostUserId),
        summary: `Started session ${s.joinCode}`,
        detail: s.endedAt ? `ended ${s.endedAt.toISOString()}` : s.status === "live" ? "live" : s.status,
        href: null,
        links: null,
      })),
      joins.map((m) => ({
        id: `join:${m.id}`,
        kind: "session_joined" as const,
        at: m.joinedAt.toISOString(),
        userId: m.userId,
        userLabel: label(m.userId),
        summary: `Joined session ${sessionCodes.get(m.sessionId) ?? ""}`.trim(),
        detail: m.leftAt ? `left ${m.leftAt.toISOString()}` : null,
        href: null,
        links: null,
      })),
      runs.map((r) => {
        const summary = parseSyncSummary(r.summaryJson);
        const meta = playlistLabel(r.sourceUrl, summary);
        const counts = [`${r.importedCount} imported`];
        if (r.unavailableCount) counts.push(`${r.unavailableCount} not available`);
        if (r.skippedCount) counts.push(`${r.skippedCount} skipped`);
        if (r.failedCount) counts.push(`${r.failedCount} failed`);
        const links = importLinks(r.sourceUrl, summary, meta);
        return {
          id: `sync:${r.id}`,
          kind: "import" as const,
          at: r.createdAt.toISOString(),
          userId: r.userId,
          userLabel: label(r.userId),
          summary: `${meta.kind === "playlist_import" ? "Playlist import" : "URL import"}: ${meta.label}`,
          detail: `${r.status} · ${counts.join(" · ")}`,
          href: links.length === 1 ? links[0]!.href : null,
          links: links.length ? links : null,
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
          href: null,
          links: null,
        })),
    ] satisfies AdminActivityEntry[][],
    limit
  );

  const last = entries.at(-1);
  return { entries, nextBefore: entries.length === limit && last ? last.at : null };
}
