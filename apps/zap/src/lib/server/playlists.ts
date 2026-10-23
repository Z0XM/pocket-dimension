import { db, schema } from "@pocket-dimension/db";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { dedupeIds, isPermutation } from "$lib/catalog-queue";
import { parsePlaylistTrackSort, sortPlaylistTracks, type PlaylistTrackSort } from "$lib/playlist-sort";
import { evaluateUserTagQuery } from "$lib/server/catalogue";
import { playlistDeleteAccess } from "$lib/playlist-permissions";
import {
  userCanEditPlaylist,
  userCanRenamePlaylist,
  userCanViewPlaylist,
  userFollowsPlaylist,
  userIsPlaylistMember,
} from "$lib/server/playlist-access";
import { generateShareCode, normalizeShareCode } from "$lib/server/playlist-share-code";
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
export type PlaylistKind = "standard" | "linked";
export type PlaylistRelation = "owner" | "collaborator" | "follower" | "linked_member" | "viewer";

export type PlaylistSummary = {
  id: string;
  name: string;
  description: string | null;
  /** Tag-query DSL the playlist is built from (null = hand-picked). */
  tagQuery: string | null;
  visibility: PlaylistVisibility;
  kind: PlaylistKind;
  /** Present for owners (share/copy); omitted for others. */
  shareCode: string | null;
  ownerUserId: string;
  trackCount: number;
  /** How this playlist appears for the requesting user. */
  relation: PlaylistRelation;
  /** Track edits (add/remove/reorder). Always false for linked + followers. */
  canEdit: boolean;
  /** Name/description changes — members of linked playlists included. */
  canRename: boolean;
  /** Owner-only: delete, visibility, and membership changes. */
  canDelete: boolean;
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
    /** When the track was added to this playlist (ISO). */
    addedAt: string;
  }[];
  exclusions: { mediaAssetId: string; title: string }[];
  collaborators: { userId: string; role: "owner" | "collaborator"; displayName: string }[];
  /** Source playlists feeding a linked playlist (empty for standard). */
  sources: { id: string; name: string; ownerUserId: string; shareCode: string | null }[];
};

const userCanEdit = userCanEditPlaylist;
const userCanView = userCanViewPlaylist;
const userCanRename = userCanRenamePlaylist;

function displayName(user: { name: string | null; username: string | null; email: string }) {
  return user.name?.trim() || user.username?.trim() || user.email;
}

async function allocateShareCode(): Promise<string> {
  for (let attempt = 0; attempt < 24; attempt++) {
    const code = generateShareCode();
    const existing = await db.query.playlists.findFirst({
      where: eq(schema.playlists.shareCode, code),
      columns: { id: true },
    });
    if (!existing) return code;
  }
  throw new PlaylistError("Could not allocate a share code", 500);
}

function relationFor(
  playlist: { ownerUserId: string; kind: PlaylistKind },
  userId: string,
  isMember: boolean,
  isFollower: boolean
): PlaylistRelation {
  if (playlist.ownerUserId === userId) return "owner";
  if (playlist.kind === "linked" && isMember) return "linked_member";
  if (isMember) return "collaborator";
  if (isFollower) return "follower";
  return "viewer";
}

function toSummaryFields(
  p: {
    id: string;
    name: string;
    description: string | null;
    tagQuery: string | null;
    visibility: PlaylistVisibility;
    kind: PlaylistKind;
    shareCode: string;
    ownerUserId: string;
    createdAt: Date;
    updatedAt: Date;
  },
  opts: {
    userId: string;
    trackCount: number;
    isMember: boolean;
    isFollower: boolean;
    canEdit: boolean;
  }
): PlaylistSummary {
  const isOwner = p.ownerUserId === opts.userId;
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    tagQuery: p.tagQuery,
    visibility: p.visibility,
    kind: p.kind,
    shareCode: isOwner ? p.shareCode : null,
    ownerUserId: p.ownerUserId,
    trackCount: opts.trackCount,
    relation: relationFor(p, opts.userId, opts.isMember, opts.isFollower),
    canEdit: opts.canEdit,
    canRename: isOwner || opts.isMember,
    canDelete: isOwner,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
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
  await syncLinkedPlaylistsForSource(playlistId, userId);
}

async function readyAssetIdsInOrder(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: schema.mediaAssets.id })
    .from(schema.mediaAssets)
    .where(and(eq(schema.mediaAssets.status, "ready"), inArray(schema.mediaAssets.id, ids)));
  const ready = new Set(rows.map((r) => r.id));
  return ids.filter((id) => ready.has(id));
}

/** Track ids of a playlist the user may view, in playlist order. */
export async function listPlaylistAssetIds(playlistId: string, userId: string): Promise<string[]> {
  if (!(await userCanView(playlistId, userId))) throw new PlaylistError("Playlist not found", 404);
  const items = await db.query.playlistItems.findMany({
    where: eq(schema.playlistItems.playlistId, playlistId),
    orderBy: [asc(schema.playlistItems.position)],
  });
  return items.map((i) => i.mediaAssetId);
}

export async function createPlaylist(opts: {
  userId: string;
  name: string;
  description?: string;
  visibility?: PlaylistVisibility;
  /** When set, the playlist is stored with this query and filled with its matches (the creator's tags). */
  tagQuery?: string | null;
  /** Freehand playlist: these tracks in this order (deduped, unplayable dropped). Ignored with `tagQuery`. */
  mediaAssetIds?: string[];
}): Promise<PlaylistSummary> {
  const name = opts.name.trim().slice(0, 80);
  if (!name) throw new PlaylistError("Name is required");
  const tagQuery = parsePlaylistTagQuery(opts.tagQuery);
  const matchedIds = tagQuery ? await tagQueryAssetIds(opts.userId, tagQuery.ast) : [];
  const freehandIds = tagQuery ? [] : await readyAssetIdsInOrder(dedupeIds(opts.mediaAssetIds ?? []).slice(0, 2000));

  const shareCode = await allocateShareCode();
  const [row] = await db
    .insert(schema.playlists)
    .values({
      ownerUserId: opts.userId,
      name,
      description: opts.description?.trim().slice(0, 280) || null,
      tagQuery: tagQuery?.text ?? null,
      visibility: opts.visibility ?? "private",
      kind: "standard",
      shareCode,
    })
    .returning();
  if (!row) throw new PlaylistError("Failed to create playlist", 500);

  await db.insert(schema.playlistMembers).values({
    playlistId: row.id,
    userId: opts.userId,
    role: "owner",
  });

  if (tagQuery) await replaceItemsWithMatches(row.id, opts.userId, matchedIds);
  else if (freehandIds.length > 0) {
    await db
      .insert(schema.playlistItems)
      .values(freehandIds.map((mediaAssetId, position) => ({ playlistId: row.id, mediaAssetId, position, addedByUserId: opts.userId })));
  }
  const trackCount = tagQuery ? await db.$count(schema.playlistItems, eq(schema.playlistItems.playlistId, row.id)) : freehandIds.length;

  return toSummaryFields(row, {
    userId: opts.userId,
    trackCount,
    isMember: true,
    isFollower: false,
    canEdit: true,
  });
}

export async function listPlaylistsForUser(userId: string): Promise<PlaylistSummary[]> {
  const owned = await db.query.playlists.findMany({
    where: eq(schema.playlists.ownerUserId, userId),
    orderBy: [desc(schema.playlists.updatedAt)],
  });
  const memberships = await db.query.playlistMembers.findMany({
    where: and(eq(schema.playlistMembers.userId, userId), eq(schema.playlistMembers.role, "collaborator")),
  });
  const follows = await db.query.playlistFollows.findMany({
    where: eq(schema.playlistFollows.userId, userId),
  });

  const ownedIds = new Set(owned.map((o) => o.id));
  const collabIds = memberships.map((m) => m.playlistId).filter((id) => !ownedIds.has(id));
  const followIds = follows.map((f) => f.playlistId).filter((id) => !ownedIds.has(id) && !collabIds.includes(id));

  const collab =
    collabIds.length > 0
      ? await db.query.playlists.findMany({
          where: inArray(schema.playlists.id, collabIds),
          orderBy: [desc(schema.playlists.updatedAt)],
        })
      : [];
  const followed =
    followIds.length > 0
      ? await db.query.playlists.findMany({
          where: and(inArray(schema.playlists.id, followIds), eq(schema.playlists.visibility, "public")),
          orderBy: [desc(schema.playlists.updatedAt)],
        })
      : [];

  const all = [...owned, ...collab, ...followed];
  if (all.length === 0) return [];

  const memberSet = new Set([...ownedIds, ...collabIds]);
  const followerSet = new Set(followed.map((p) => p.id));

  const items = await db.query.playlistItems.findMany({
    where: inArray(
      schema.playlistItems.playlistId,
      all.map((p) => p.id)
    ),
  });
  const countBy = new Map<string, number>();
  for (const i of items) countBy.set(i.playlistId, (countBy.get(i.playlistId) ?? 0) + 1);

  return all.map((p) => {
    const isMember = memberSet.has(p.id);
    const isFollower = followerSet.has(p.id);
    const canEdit = p.kind !== "linked" && isMember;
    return toSummaryFields(p, {
      userId,
      trackCount: countBy.get(p.id) ?? 0,
      isMember,
      isFollower,
      canEdit,
    });
  });
}

/** Additive sync: append any new ready tracks from source playlists (never removes). */
export async function syncLinkedPlaylistFromSources(linkedPlaylistId: string, actorUserId: string): Promise<number> {
  const linked = await db.query.playlists.findFirst({ where: eq(schema.playlists.id, linkedPlaylistId) });
  if (!linked || linked.kind !== "linked") return 0;

  const sources = await db.query.linkedPlaylistSources.findMany({
    where: eq(schema.linkedPlaylistSources.linkedPlaylistId, linkedPlaylistId),
  });
  if (sources.length === 0) return 0;

  const sourceItems = await db.query.playlistItems.findMany({
    where: inArray(
      schema.playlistItems.playlistId,
      sources.map((s) => s.sourcePlaylistId)
    ),
    orderBy: [asc(schema.playlistItems.createdAt), asc(schema.playlistItems.position)],
  });

  const existing = await db.query.playlistItems.findMany({
    where: eq(schema.playlistItems.playlistId, linkedPlaylistId),
  });
  const have = new Set(existing.map((i) => i.mediaAssetId));
  const last = existing.reduce((max, i) => Math.max(max, i.position), -1);

  const toAdd: string[] = [];
  const seen = new Set<string>();
  for (const item of sourceItems) {
    if (have.has(item.mediaAssetId) || seen.has(item.mediaAssetId)) continue;
    seen.add(item.mediaAssetId);
    toAdd.push(item.mediaAssetId);
  }
  if (toAdd.length === 0) return 0;

  const ready = await readyAssetIdsInOrder(toAdd);
  if (ready.length === 0) return 0;

  await db.insert(schema.playlistItems).values(
    ready.map((mediaAssetId, i) => ({
      playlistId: linkedPlaylistId,
      mediaAssetId,
      position: last + 1 + i,
      addedByUserId: actorUserId,
    }))
  );
  await db
    .update(schema.playlists)
    .set({ updatedAt: sql`now()` })
    .where(eq(schema.playlists.id, linkedPlaylistId));
  return ready.length;
}

/** After a source playlist gains tracks, push them into any linked playlists that use it. */
async function syncLinkedPlaylistsForSource(sourcePlaylistId: string, actorUserId: string) {
  const links = await db.query.linkedPlaylistSources.findMany({
    where: eq(schema.linkedPlaylistSources.sourcePlaylistId, sourcePlaylistId),
  });
  for (const link of links) {
    await syncLinkedPlaylistFromSources(link.linkedPlaylistId, actorUserId);
  }
}

export async function getPlaylistDetail(playlistId: string, userId: string): Promise<PlaylistDetail> {
  if (!(await userCanView(playlistId, userId))) throw new PlaylistError("Playlist not found", 404);
  let playlist = await db.query.playlists.findFirst({ where: eq(schema.playlists.id, playlistId) });
  if (!playlist) throw new PlaylistError("Playlist not found", 404);

  if (playlist.kind === "linked") {
    await syncLinkedPlaylistFromSources(playlistId, playlist.ownerUserId);
    playlist = (await db.query.playlists.findFirst({ where: eq(schema.playlists.id, playlistId) })) ?? playlist;
  }

  const [items, exclusions, members, sourceRows] = await Promise.all([
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
    playlist.kind === "linked"
      ? db.query.linkedPlaylistSources.findMany({
          where: eq(schema.linkedPlaylistSources.linkedPlaylistId, playlistId),
        })
      : Promise.resolve([]),
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

  const sourcePlaylists =
    sourceRows.length > 0
      ? await db.query.playlists.findMany({
          where: inArray(
            schema.playlists.id,
            sourceRows.map((s) => s.sourcePlaylistId)
          ),
        })
      : [];
  const sourceById = new Map(sourcePlaylists.map((p) => [p.id, p]));

  const isMember = await userIsPlaylistMember(playlistId, userId);
  const isFollower = await userFollowsPlaylist(playlistId, userId);
  const canEdit = await userCanEdit(playlistId, userId);

  return {
    ...toSummaryFields(playlist, {
      userId,
      trackCount: items.length,
      isMember,
      isFollower,
      canEdit,
    }),
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
        addedAt: i.createdAt.toISOString(),
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
    sources: sourceRows.map((s) => {
      const src = sourceById.get(s.sourcePlaylistId);
      return {
        id: s.sourcePlaylistId,
        name: src?.name ?? "Playlist",
        ownerUserId: src?.ownerUserId ?? "",
        shareCode: src?.shareCode ?? null,
      };
    }),
  };
}

export async function updatePlaylist(
  playlistId: string,
  userId: string,
  patch: { name?: string; description?: string | null; visibility?: PlaylistVisibility }
): Promise<PlaylistDetail> {
  const playlist = await db.query.playlists.findFirst({ where: eq(schema.playlists.id, playlistId) });
  if (!playlist) throw new PlaylistError("Playlist not found", 404);

  const renaming = patch.name !== undefined || patch.description !== undefined;
  const changingVisibility = patch.visibility !== undefined;
  if (!renaming && !changingVisibility) throw new PlaylistError("Nothing to update");

  if (renaming && !(await userCanRename(playlistId, userId))) throw new PlaylistError("Not allowed", 403);
  if (changingVisibility) {
    if (playlist.ownerUserId !== userId) throw new PlaylistError("Only the owner can change visibility", 403);
    if (playlist.kind === "linked") throw new PlaylistError("Linked playlists stay shared with their members", 400);
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

/**
 * Delete a playlist with its items, exclusions and memberships. Catalogue queues hold media ids, not playlist
 * ids, so queues filled from (or saved as) this playlist keep playing.
 */
export async function deletePlaylist(playlistId: string, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [playlist] = await tx.select().from(schema.playlists).where(eq(schema.playlists.id, playlistId)).for("update");
    const member = playlist
      ? await tx.query.playlistMembers.findFirst({
          where: and(eq(schema.playlistMembers.playlistId, playlistId), eq(schema.playlistMembers.userId, userId)),
        })
      : undefined;
    const access = playlistDeleteAccess(playlist, userId, Boolean(member));
    if (access === "not_found") throw new PlaylistError("Playlist not found", 404);
    if (access === "forbidden") throw new PlaylistError("Only the owner can delete this playlist", 403);

    await tx.delete(schema.playlistItems).where(eq(schema.playlistItems.playlistId, playlistId));
    await tx.delete(schema.playlistExclusions).where(eq(schema.playlistExclusions.playlistId, playlistId));
    await tx.delete(schema.playlistMembers).where(eq(schema.playlistMembers.playlistId, playlistId));
    await tx.delete(schema.playlistFollows).where(eq(schema.playlistFollows.playlistId, playlistId));
    await tx.delete(schema.linkedPlaylistSources).where(
      or(
        eq(schema.linkedPlaylistSources.linkedPlaylistId, playlistId),
        eq(schema.linkedPlaylistSources.sourcePlaylistId, playlistId)
      )
    );
    await tx.delete(schema.playlists).where(eq(schema.playlists.id, playlistId));
  });
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
  await syncLinkedPlaylistsForSource(playlistId, userId);
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

/**
 * Rewrite playlist item positions to 0..n-1 in `itemIds` order.
 * Two-phase (high offset, then final) so the (playlist_id, position) unique index never clashes mid-update.
 */
async function writePlaylistItemOrder(itemIds: string[]) {
  if (itemIds.length === 0) return;
  const offset = 2_000_000;
  for (let i = 0; i < itemIds.length; i++) {
    await db.update(schema.playlistItems).set({ position: offset + i }).where(eq(schema.playlistItems.id, itemIds[i]!));
  }
  for (let i = 0; i < itemIds.length; i++) {
    await db.update(schema.playlistItems).set({ position: i }).where(eq(schema.playlistItems.id, itemIds[i]!));
  }
}

/**
 * DnD reorder — `orderedItemIds` must be a permutation of current playlist item row ids.
 * Allowed for freehand and tag-query playlists; tag rebuild later may overwrite order.
 */
export async function reorderPlaylistTracks(playlistId: string, userId: string, orderedItemIds: string[]): Promise<PlaylistDetail> {
  if (!(await userCanEdit(playlistId, userId))) throw new PlaylistError("Not allowed", 403);
  const items = await db.query.playlistItems.findMany({
    where: eq(schema.playlistItems.playlistId, playlistId),
    orderBy: [asc(schema.playlistItems.position)],
  });
  const currentIds = items.map((i) => i.id);
  if (!isPermutation(currentIds, orderedItemIds)) {
    throw new PlaylistError("Playlist changed — refresh and try again", 409);
  }
  await writePlaylistItemOrder(orderedItemIds);
  await db
    .update(schema.playlists)
    .set({ updatedAt: sql`now()` })
    .where(eq(schema.playlists.id, playlistId));
  return getPlaylistDetail(playlistId, userId);
}

/**
 * Sort playlist tracks and persist the new positions.
 * For tag-query playlists the order sticks until the next rebuild (which replaces items in title order).
 */
export async function sortPlaylistTracksPersisted(
  playlistId: string,
  userId: string,
  sort: PlaylistTrackSort | string
): Promise<PlaylistDetail> {
  if (!(await userCanEdit(playlistId, userId))) throw new PlaylistError("Not allowed", 403);
  const mode = typeof sort === "string" ? parsePlaylistTrackSort(sort) : sort;
  if (!mode) throw new PlaylistError("Unknown sort");

  const detail = await getPlaylistDetail(playlistId, userId);
  if (detail.items.length === 0) return detail;

  const ordered = sortPlaylistTracks(
    detail.items.map((i) => ({ id: i.id, title: i.title, artists: i.artists, addedAt: i.addedAt })),
    mode
  );
  await writePlaylistItemOrder(ordered.map((i) => i.id));
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
    if (asset?.status === "ready") {
      if (await appendPlaylistItem(playlistId, userId, mediaAssetId)) {
        await syncLinkedPlaylistsForSource(playlistId, userId);
      }
    }
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

export async function followPlaylistByShareCode(userId: string, rawCode: string): Promise<PlaylistDetail> {
  const code = normalizeShareCode(rawCode);
  if (!code) throw new PlaylistError("Enter a share code");

  const playlist = await db.query.playlists.findFirst({ where: eq(schema.playlists.shareCode, code) });
  if (!playlist) throw new PlaylistError("Playlist not found", 404);
  if (playlist.visibility === "private") throw new PlaylistError("Private playlists cannot be followed", 403);
  if (playlist.ownerUserId === userId) throw new PlaylistError("You already own this playlist");
  if (await userIsPlaylistMember(playlist.id, userId)) {
    throw new PlaylistError("You already collaborate on this playlist");
  }

  await db.insert(schema.playlistFollows).values({ playlistId: playlist.id, userId }).onConflictDoNothing();
  return getPlaylistDetail(playlist.id, userId);
}

export async function unfollowPlaylist(playlistId: string, userId: string): Promise<void> {
  await db
    .delete(schema.playlistFollows)
    .where(and(eq(schema.playlistFollows.playlistId, playlistId), eq(schema.playlistFollows.userId, userId)));
}

/**
 * Linked playlist from public standard sources owned by different accounts.
 * Members can play + rename; tracks only arrive via additive sync from sources.
 */
export async function createLinkedPlaylist(opts: {
  userId: string;
  name: string;
  sourcePlaylistIds: string[];
  /** Optional emails/usernames to add as members (in addition to the creator). */
  memberQueries?: string[];
}): Promise<PlaylistDetail> {
  const name = opts.name.trim().slice(0, 80);
  if (!name) throw new PlaylistError("Name is required");

  const ids = [...new Set(opts.sourcePlaylistIds)].slice(0, 12);
  if (ids.length < 2) throw new PlaylistError("Pick at least two source playlists");

  const sources = await db.query.playlists.findMany({ where: inArray(schema.playlists.id, ids) });
  if (sources.length !== ids.length) throw new PlaylistError("Source playlist not found", 404);

  for (const src of sources) {
    if (src.kind !== "standard") throw new PlaylistError("Only standard playlists can be link sources");
    if (src.visibility === "private") throw new PlaylistError("Private playlists cannot be used as link sources", 403);
  }

  const ownerIds = sources.map((s) => s.ownerUserId);
  if (new Set(ownerIds).size !== ownerIds.length) {
    throw new PlaylistError("Source playlists must belong to different accounts");
  }

  const shareCode = await allocateShareCode();
  const [row] = await db
    .insert(schema.playlists)
    .values({
      ownerUserId: opts.userId,
      name,
      description: `Linked from ${ids.length} playlists`,
      tagQuery: null,
      visibility: "public",
      kind: "linked",
      shareCode,
    })
    .returning();
  if (!row) throw new PlaylistError("Failed to create linked playlist", 500);

  await db.insert(schema.playlistMembers).values({ playlistId: row.id, userId: opts.userId, role: "owner" });
  await db.insert(schema.linkedPlaylistSources).values(
    ids.map((sourcePlaylistId) => ({ linkedPlaylistId: row.id, sourcePlaylistId }))
  );

  const memberQueries = [...new Set((opts.memberQueries ?? []).map((q) => q.trim()).filter(Boolean))].slice(0, 12);
  for (const q of memberQueries) {
    const memberId = await findUserIdByEmailOrUsername(q);
    if (!memberId) throw new PlaylistError(`Member not found: ${q}`, 404);
    if (memberId === opts.userId) continue;
    await db.insert(schema.playlistMembers).values({ playlistId: row.id, userId: memberId, role: "collaborator" }).onConflictDoNothing();
  }

  await syncLinkedPlaylistFromSources(row.id, opts.userId);
  return getPlaylistDetail(row.id, opts.userId);
}

/** Resolve public playlists by share codes for the linked-create UI. */
export async function lookupPlaylistByShareCode(userId: string, rawCode: string): Promise<PlaylistSummary> {
  const code = normalizeShareCode(rawCode);
  if (!code) throw new PlaylistError("Enter a share code");
  const playlist = await db.query.playlists.findFirst({ where: eq(schema.playlists.shareCode, code) });
  if (!playlist) throw new PlaylistError("Playlist not found", 404);
  if (playlist.visibility === "private") throw new PlaylistError("Private playlists cannot be linked", 403);
  if (playlist.kind !== "standard") throw new PlaylistError("Only standard playlists can be link sources");
  if (!(await userCanView(playlist.id, userId))) throw new PlaylistError("Playlist not found", 404);

  const trackCount = await db.$count(schema.playlistItems, eq(schema.playlistItems.playlistId, playlist.id));
  const isMember = await userIsPlaylistMember(playlist.id, userId);
  const isFollower = await userFollowsPlaylist(playlist.id, userId);
  return toSummaryFields(playlist, {
    userId,
    trackCount,
    isMember,
    isFollower,
    canEdit: false,
  });
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
