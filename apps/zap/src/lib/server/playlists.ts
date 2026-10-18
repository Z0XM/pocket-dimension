import { db, schema } from "@pocket-dimension/db";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { evaluateUserTagQuery } from "$lib/server/catalogue";
import { SessionError, enqueueCatalogueTrack } from "$lib/server/sessions";
import type { SessionSnapshot } from "$lib/server/sessions/types";
import { formatTagQuery, parseTagQuery, type TagQueryNode } from "$lib/tag-query";

export class PlaylistError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message);
    this.name = "PlaylistError";
  }
}

export type PlaylistVisibility = "private" | "public";

export type PlaylistSummary = {
  id: string;
  name: string;
  description: string | null;
  /** Tag-query DSL the playlist is built from (null = hand-picked). */
  tagQuery: string | null;
  visibility: PlaylistVisibility;
  ownerUserId: string;
  trackCount: number;
  canEdit: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PlaylistDetail = PlaylistSummary & {
  items: {
    id: string;
    mediaAssetId: string;
    position: number;
    title: string;
    artists: string | null;
    durationMs: number | null;
    playable: boolean;
  }[];
  exclusions: { mediaAssetId: string; title: string }[];
  collaborators: { userId: string; role: "owner" | "collaborator"; displayName: string }[];
};

async function userCanEdit(playlistId: string, userId: string): Promise<boolean> {
  const playlist = await db.query.playlists.findFirst({ where: eq(schema.playlists.id, playlistId) });
  if (!playlist) return false;
  if (playlist.ownerUserId === userId) return true;
  const member = await db.query.playlistMembers.findFirst({
    where: and(eq(schema.playlistMembers.playlistId, playlistId), eq(schema.playlistMembers.userId, userId)),
  });
  return Boolean(member);
}

async function userCanView(playlistId: string, userId: string): Promise<boolean> {
  const playlist = await db.query.playlists.findFirst({ where: eq(schema.playlists.id, playlistId) });
  if (!playlist) return false;
  if (playlist.visibility === "public") return true;
  if (playlist.ownerUserId === userId) return true;
  const member = await db.query.playlistMembers.findFirst({
    where: and(eq(schema.playlistMembers.playlistId, playlistId), eq(schema.playlistMembers.userId, userId)),
  });
  return Boolean(member);
}

function displayName(user: { name: string | null; username: string | null; email: string }) {
  return user.name?.trim() || user.username?.trim() || user.email;
}

export const MAX_PLAYLIST_TAG_QUERY_LENGTH = 500;

/** Parse a tag query for storage. Empty → null; invalid syntax → PlaylistError. Unknown tags are reported when the playlist is built. */
export function parsePlaylistTagQuery(raw: string | null | undefined): { text: string; ast: TagQueryNode } | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  if (trimmed.length > MAX_PLAYLIST_TAG_QUERY_LENGTH) throw new PlaylistError("Tag query is too long");
  const parsed = parseTagQuery(trimmed);
  if (!parsed.ok) throw new PlaylistError(`Tag query: ${parsed.error}`);
  return { text: formatTagQuery(parsed.ast), ast: parsed.ast };
}

async function tagQueryAssetIds(userId: string, ast: TagQueryNode): Promise<string[]> {
  const evaluated = await evaluateUserTagQuery(userId, ast);
  if (!evaluated.ok) throw new PlaylistError(`Tag query: ${evaluated.error}`);
  return [...evaluated.assetIds];
}

/** Replace playlist items with the playable subset of `assetIds` (title order), minus exclusions. */
async function replaceItemsWithMatches(playlistId: string, userId: string, assetIds: string[]) {
  const exclusions = await db.query.playlistExclusions.findMany({
    where: eq(schema.playlistExclusions.playlistId, playlistId),
  });
  const excluded = new Set(exclusions.map((e) => e.mediaAssetId));
  const keep = assetIds.filter((id) => !excluded.has(id));

  const ready =
    keep.length === 0
      ? []
      : await db.query.mediaAssets.findMany({
          where: and(eq(schema.mediaAssets.status, "ready"), inArray(schema.mediaAssets.id, keep)),
          orderBy: [asc(schema.mediaAssets.title)],
        });

  await db.delete(schema.playlistItems).where(eq(schema.playlistItems.playlistId, playlistId));
  if (ready.length > 0) {
    await db.insert(schema.playlistItems).values(
      ready.map((a, position) => ({
        playlistId,
        mediaAssetId: a.id,
        position,
        addedByUserId: userId,
      }))
    );
  }
}

export async function createPlaylist(opts: {
  userId: string;
  name: string;
  description?: string;
  visibility?: PlaylistVisibility;
  /** When set, the playlist is stored with this query and filled with its matches (the creator's tags). */
  tagQuery?: string | null;
}): Promise<PlaylistSummary> {
  const name = opts.name.trim().slice(0, 80);
  if (!name) throw new PlaylistError("Name is required");
  const tagQuery = parsePlaylistTagQuery(opts.tagQuery);
  const matchedIds = tagQuery ? await tagQueryAssetIds(opts.userId, tagQuery.ast) : [];

  const [row] = await db
    .insert(schema.playlists)
    .values({
      ownerUserId: opts.userId,
      name,
      description: opts.description?.trim().slice(0, 280) || null,
      tagQuery: tagQuery?.text ?? null,
      visibility: opts.visibility ?? "private",
    })
    .returning();
  if (!row) throw new PlaylistError("Failed to create playlist", 500);

  await db.insert(schema.playlistMembers).values({
    playlistId: row.id,
    userId: opts.userId,
    role: "owner",
  });

  if (tagQuery) await replaceItemsWithMatches(row.id, opts.userId, matchedIds);
  const trackCount = tagQuery ? await db.$count(schema.playlistItems, eq(schema.playlistItems.playlistId, row.id)) : 0;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    tagQuery: row.tagQuery,
    visibility: row.visibility,
    ownerUserId: row.ownerUserId,
    trackCount,
    canEdit: true,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPlaylistsForUser(userId: string): Promise<PlaylistSummary[]> {
  const owned = await db.query.playlists.findMany({
    where: eq(schema.playlists.ownerUserId, userId),
    orderBy: [desc(schema.playlists.updatedAt)],
  });
  const memberships = await db.query.playlistMembers.findMany({
    where: and(eq(schema.playlistMembers.userId, userId), eq(schema.playlistMembers.role, "collaborator")),
  });
  const collabIds = memberships.map((m) => m.playlistId).filter((id) => !owned.some((o) => o.id === id));
  const collab =
    collabIds.length > 0
      ? await db.query.playlists.findMany({
          where: inArray(schema.playlists.id, collabIds),
          orderBy: [desc(schema.playlists.updatedAt)],
        })
      : [];

  const all = [...owned, ...collab];
  if (all.length === 0) return [];

  const items = await db.query.playlistItems.findMany({
    where: inArray(
      schema.playlistItems.playlistId,
      all.map((p) => p.id)
    ),
  });
  const countBy = new Map<string, number>();
  for (const i of items) countBy.set(i.playlistId, (countBy.get(i.playlistId) ?? 0) + 1);

  return all.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    tagQuery: p.tagQuery,
    visibility: p.visibility,
    ownerUserId: p.ownerUserId,
    trackCount: countBy.get(p.id) ?? 0,
    canEdit: p.ownerUserId === userId || collabIds.includes(p.id),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));
}

export async function getPlaylistDetail(playlistId: string, userId: string): Promise<PlaylistDetail> {
  if (!(await userCanView(playlistId, userId))) throw new PlaylistError("Playlist not found", 404);
  const playlist = await db.query.playlists.findFirst({ where: eq(schema.playlists.id, playlistId) });
  if (!playlist) throw new PlaylistError("Playlist not found", 404);

  const [items, exclusions, members] = await Promise.all([
    db.query.playlistItems.findMany({
      where: eq(schema.playlistItems.playlistId, playlistId),
      orderBy: [asc(schema.playlistItems.position)],
    }),
    db.query.playlistExclusions.findMany({
      where: eq(schema.playlistExclusions.playlistId, playlistId),
    }),
    db.query.playlistMembers.findMany({
      where: eq(schema.playlistMembers.playlistId, playlistId),
    }),
  ]);

  const assetIds = [...new Set([...items.map((i) => i.mediaAssetId), ...exclusions.map((e) => e.mediaAssetId)])];
  const assets =
    assetIds.length > 0
      ? await db.query.mediaAssets.findMany({
          where: inArray(schema.mediaAssets.id, assetIds),
        })
      : [];
  const assetById = new Map(assets.map((a) => [a.id, a]));

  const userIds = [...new Set(members.map((m) => m.userId))];
  const users =
    userIds.length > 0
      ? await db.query.user.findMany({
          where: inArray(schema.user.id, userIds),
        })
      : [];
  const nameById = new Map(users.map((u) => [u.id, displayName(u)]));

  const canEdit = await userCanEdit(playlistId, userId);

  return {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    tagQuery: playlist.tagQuery,
    visibility: playlist.visibility,
    ownerUserId: playlist.ownerUserId,
    trackCount: items.length,
    canEdit,
    createdAt: playlist.createdAt.toISOString(),
    updatedAt: playlist.updatedAt.toISOString(),
    items: items.map((i) => {
      const a = assetById.get(i.mediaAssetId);
      return {
        id: i.id,
        mediaAssetId: i.mediaAssetId,
        position: i.position,
        title: a?.title ?? "Unknown",
        artists: a?.artists ?? null,
        durationMs: a?.durationMs ?? null,
        playable: Boolean(a?.storageKey && a.status === "ready"),
      };
    }),
    exclusions: exclusions.map((e) => ({
      mediaAssetId: e.mediaAssetId,
      title: assetById.get(e.mediaAssetId)?.title ?? "Unknown",
    })),
    collaborators: members.map((m) => ({
      userId: m.userId,
      role: m.role,
      displayName: nameById.get(m.userId) ?? "Listener",
    })),
  };
}

export async function updatePlaylist(
  playlistId: string,
  userId: string,
  patch: { name?: string; description?: string | null; visibility?: PlaylistVisibility }
): Promise<PlaylistDetail> {
  if (!(await userCanEdit(playlistId, userId))) throw new PlaylistError("Not allowed", 403);
  const playlist = await db.query.playlists.findFirst({ where: eq(schema.playlists.id, playlistId) });
  if (!playlist) throw new PlaylistError("Playlist not found", 404);
  if (playlist.ownerUserId !== userId && patch.visibility !== undefined) {
    throw new PlaylistError("Only the owner can change visibility", 403);
  }

  await db
    .update(schema.playlists)
    .set({
      ...(patch.name !== undefined ? { name: patch.name.trim().slice(0, 80) || playlist.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description?.trim().slice(0, 280) || null } : {}),
      ...(patch.visibility !== undefined ? { visibility: patch.visibility } : {}),
      updatedAt: sql`now()`,
    })
    .where(eq(schema.playlists.id, playlistId));

  return getPlaylistDetail(playlistId, userId);
}

export async function deletePlaylist(playlistId: string, userId: string): Promise<void> {
  const playlist = await db.query.playlists.findFirst({ where: eq(schema.playlists.id, playlistId) });
  if (!playlist) throw new PlaylistError("Playlist not found", 404);
  if (playlist.ownerUserId !== userId) throw new PlaylistError("Only the owner can delete", 403);
  await db.delete(schema.playlists).where(eq(schema.playlists.id, playlistId));
}

/** Append a track to the end of the playlist unless it is already there. Returns whether a row was inserted. */
async function appendPlaylistItem(playlistId: string, userId: string, mediaAssetId: string): Promise<boolean> {
  const existing = await db.query.playlistItems.findFirst({
    where: and(eq(schema.playlistItems.playlistId, playlistId), eq(schema.playlistItems.mediaAssetId, mediaAssetId)),
  });
  if (existing) return false;

  const last = await db.query.playlistItems.findFirst({
    where: eq(schema.playlistItems.playlistId, playlistId),
    orderBy: [desc(schema.playlistItems.position)],
  });
  await db.insert(schema.playlistItems).values({
    playlistId,
    mediaAssetId,
    position: (last?.position ?? -1) + 1,
    addedByUserId: userId,
  });
  return true;
}

export async function addPlaylistTrack(playlistId: string, userId: string, mediaAssetId: string): Promise<PlaylistDetail> {
  if (!(await userCanEdit(playlistId, userId))) throw new PlaylistError("Not allowed", 403);
  const asset = await db.query.mediaAssets.findFirst({ where: eq(schema.mediaAssets.id, mediaAssetId) });
  if (!asset || asset.status !== "ready") throw new PlaylistError("Track not playable");

  if (!(await appendPlaylistItem(playlistId, userId, mediaAssetId))) return getPlaylistDetail(playlistId, userId);
  await db
    .update(schema.playlists)
    .set({ updatedAt: sql`now()` })
    .where(eq(schema.playlists.id, playlistId));
  return getPlaylistDetail(playlistId, userId);
}

/** Delete a track from the playlist and renumber the remaining positions 0..n-1. */
async function deletePlaylistItem(playlistId: string, mediaAssetId: string) {
  await db
    .delete(schema.playlistItems)
    .where(and(eq(schema.playlistItems.playlistId, playlistId), eq(schema.playlistItems.mediaAssetId, mediaAssetId)));

  const remaining = await db.query.playlistItems.findMany({
    where: eq(schema.playlistItems.playlistId, playlistId),
    orderBy: [asc(schema.playlistItems.position)],
  });
  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i]!.position !== i) {
      await db.update(schema.playlistItems).set({ position: i }).where(eq(schema.playlistItems.id, remaining[i]!.id));
    }
  }
}

export async function removePlaylistTrack(playlistId: string, userId: string, mediaAssetId: string): Promise<PlaylistDetail> {
  if (!(await userCanEdit(playlistId, userId))) throw new PlaylistError("Not allowed", 403);
  await deletePlaylistItem(playlistId, mediaAssetId);
  await db
    .update(schema.playlists)
    .set({ updatedAt: sql`now()` })
    .where(eq(schema.playlists.id, playlistId));
  return getPlaylistDetail(playlistId, userId);
}

export async function setPlaylistExclusion(playlistId: string, userId: string, mediaAssetId: string, excluded: boolean): Promise<PlaylistDetail> {
  if (!(await userCanEdit(playlistId, userId))) throw new PlaylistError("Not allowed", 403);
  if (excluded) {
    await db.insert(schema.playlistExclusions).values({ playlistId, mediaAssetId }).onConflictDoNothing();
    await deletePlaylistItem(playlistId, mediaAssetId);
  } else {
    await db
      .delete(schema.playlistExclusions)
      .where(and(eq(schema.playlistExclusions.playlistId, playlistId), eq(schema.playlistExclusions.mediaAssetId, mediaAssetId)));
    const asset = await db.query.mediaAssets.findFirst({ where: eq(schema.mediaAssets.id, mediaAssetId) });
    if (asset?.status === "ready") await appendPlaylistItem(playlistId, userId, mediaAssetId);
  }
  await db
    .update(schema.playlists)
    .set({ updatedAt: sql`now()` })
    .where(eq(schema.playlists.id, playlistId));
  return getPlaylistDetail(playlistId, userId);
}

/**
 * Rebuild playlist items from the user's tags (AND of tagIds), minus exclusions.
 * Replaces existing items.
 */
export async function buildPlaylistFromTags(playlistId: string, userId: string, tagIds: string[]): Promise<PlaylistDetail> {
  if (!(await userCanEdit(playlistId, userId))) throw new PlaylistError("Not allowed", 403);
  const uniqueTags = [...new Set(tagIds.map((t) => t.trim()).filter(Boolean))];
  if (uniqueTags.length === 0) throw new PlaylistError("Pick at least one tag");

  const matched = await db
    .select({
      mediaAssetId: schema.mediaAssetTags.mediaAssetId,
      count: sql<number>`count(distinct ${schema.mediaAssetTags.tagId})::int`,
    })
    .from(schema.mediaAssetTags)
    .where(and(eq(schema.mediaAssetTags.userId, userId), inArray(schema.mediaAssetTags.tagId, uniqueTags)))
    .groupBy(schema.mediaAssetTags.mediaAssetId)
    .having(sql`count(distinct ${schema.mediaAssetTags.tagId}) = ${uniqueTags.length}`);

  await replaceItemsWithMatches(
    playlistId,
    userId,
    matched.map((m) => m.mediaAssetId)
  );
  await db
    .update(schema.playlists)
    .set({ updatedAt: sql`now()` })
    .where(eq(schema.playlists.id, playlistId));
  return getPlaylistDetail(playlistId, userId);
}

/**
 * Save (or clear) the playlist's tag query. A non-empty query rebuilds items from the editor's tags,
 * minus exclusions; clearing keeps the current items.
 */
export async function setPlaylistTagQuery(playlistId: string, userId: string, rawTagQuery: string | null): Promise<PlaylistDetail> {
  if (!(await userCanEdit(playlistId, userId))) throw new PlaylistError("Not allowed", 403);
  const tagQuery = parsePlaylistTagQuery(rawTagQuery);
  if (tagQuery) await replaceItemsWithMatches(playlistId, userId, await tagQueryAssetIds(userId, tagQuery.ast));
  await db
    .update(schema.playlists)
    .set({ tagQuery: tagQuery?.text ?? null, updatedAt: sql`now()` })
    .where(eq(schema.playlists.id, playlistId));
  return getPlaylistDetail(playlistId, userId);
}

export async function addCollaborator(playlistId: string, ownerUserId: string, collaboratorUserId: string): Promise<PlaylistDetail> {
  const playlist = await db.query.playlists.findFirst({ where: eq(schema.playlists.id, playlistId) });
  if (!playlist) throw new PlaylistError("Playlist not found", 404);
  if (playlist.ownerUserId !== ownerUserId) throw new PlaylistError("Only the owner can add collaborators", 403);
  if (collaboratorUserId === ownerUserId) throw new PlaylistError("Owner is already a member");

  const user = await db.query.user.findFirst({ where: eq(schema.user.id, collaboratorUserId) });
  if (!user) throw new PlaylistError("User not found", 404);

  await db.insert(schema.playlistMembers).values({ playlistId, userId: collaboratorUserId, role: "collaborator" }).onConflictDoNothing();

  return getPlaylistDetail(playlistId, ownerUserId);
}

export async function removeCollaborator(playlistId: string, ownerUserId: string, collaboratorUserId: string): Promise<PlaylistDetail> {
  const playlist = await db.query.playlists.findFirst({ where: eq(schema.playlists.id, playlistId) });
  if (!playlist) throw new PlaylistError("Playlist not found", 404);
  if (playlist.ownerUserId !== ownerUserId) throw new PlaylistError("Only the owner can remove collaborators", 403);

  await db
    .delete(schema.playlistMembers)
    .where(
      and(
        eq(schema.playlistMembers.playlistId, playlistId),
        eq(schema.playlistMembers.userId, collaboratorUserId),
        eq(schema.playlistMembers.role, "collaborator")
      )
    );
  return getPlaylistDetail(playlistId, ownerUserId);
}

/** Merge two playlists (or libraries-as-playlists) into a new owned playlist. Dedupes by mediaAssetId. */
export async function mergePlaylists(opts: {
  userId: string;
  sourcePlaylistIds: string[];
  name: string;
  visibility?: PlaylistVisibility;
}): Promise<PlaylistDetail> {
  const ids = [...new Set(opts.sourcePlaylistIds)].slice(0, 8);
  if (ids.length < 2) throw new PlaylistError("Pick at least two playlists to merge");

  for (const id of ids) {
    if (!(await userCanView(id, opts.userId))) throw new PlaylistError("Playlist not found", 404);
  }

  const items = await db.query.playlistItems.findMany({
    where: inArray(schema.playlistItems.playlistId, ids),
    orderBy: [asc(schema.playlistItems.position)],
  });

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const item of items) {
    if (seen.has(item.mediaAssetId)) continue;
    seen.add(item.mediaAssetId);
    ordered.push(item.mediaAssetId);
  }

  const created = await createPlaylist({
    userId: opts.userId,
    name: opts.name,
    visibility: opts.visibility ?? "private",
    description: `Merged from ${ids.length} playlists`,
  });

  if (ordered.length > 0) {
    await db.insert(schema.playlistItems).values(
      ordered.map((mediaAssetId, position) => ({
        playlistId: created.id,
        mediaAssetId,
        position,
        addedByUserId: opts.userId,
      }))
    );
  }

  return getPlaylistDetail(created.id, opts.userId);
}

/** Build a transient ordered asset list from another user's public playlist or shared collab. */
export async function findUserIdByEmailOrUsername(query: string): Promise<string | null> {
  const q = query.trim();
  if (!q) return null;
  const user = await db.query.user.findFirst({
    where: or(eq(schema.user.email, q.toLowerCase()), eq(schema.user.username, q)),
  });
  return user?.id ?? null;
}

/** Enqueue all playlist tracks into a live session (playlist order). */
export async function loadPlaylistIntoSession(sessionId: string, userId: string, playlistId: string): Promise<SessionSnapshot> {
  if (!(await userCanView(playlistId, userId))) throw new PlaylistError("Playlist not found", 404);
  const items = await db.query.playlistItems.findMany({
    where: eq(schema.playlistItems.playlistId, playlistId),
    orderBy: [asc(schema.playlistItems.position)],
  });
  if (items.length === 0) throw new PlaylistError("Playlist is empty", 400);

  let snapshot: SessionSnapshot | null = null;
  try {
    for (const item of items) {
      snapshot = await enqueueCatalogueTrack(sessionId, userId, item.mediaAssetId);
    }
  } catch (err) {
    if (err instanceof SessionError) throw new PlaylistError(err.message, err.status);
    throw err;
  }
  if (!snapshot) throw new PlaylistError("Failed to load playlist", 500);
  return snapshot;
}
