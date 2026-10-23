import { db, schema } from "@pocket-dimension/db";
import { and, eq } from "drizzle-orm";

export async function userIsPlaylistMember(playlistId: string, userId: string): Promise<boolean> {
  const member = await db.query.playlistMembers.findFirst({
    where: and(eq(schema.playlistMembers.playlistId, playlistId), eq(schema.playlistMembers.userId, userId)),
  });
  return Boolean(member);
}

export async function userFollowsPlaylist(playlistId: string, userId: string): Promise<boolean> {
  const follow = await db.query.playlistFollows.findFirst({
    where: and(eq(schema.playlistFollows.playlistId, playlistId), eq(schema.playlistFollows.userId, userId)),
  });
  return Boolean(follow);
}

/** Track edits: owner or collaborator on a *standard* playlist (linked playlists never allow manual track changes). */
export async function userCanEditPlaylist(playlistId: string, userId: string): Promise<boolean> {
  const playlist = await db.query.playlists.findFirst({ where: eq(schema.playlists.id, playlistId) });
  if (!playlist) return false;
  if (playlist.kind === "linked") return false;
  if (playlist.ownerUserId === userId) return true;
  return userIsPlaylistMember(playlistId, userId);
}

/** Rename / description: owner or any member (including linked playlist members). Not followers. */
export async function userCanRenamePlaylist(playlistId: string, userId: string): Promise<boolean> {
  const playlist = await db.query.playlists.findFirst({ where: eq(schema.playlists.id, playlistId) });
  if (!playlist) return false;
  if (playlist.ownerUserId === userId) return true;
  return userIsPlaylistMember(playlistId, userId);
}

export async function userCanViewPlaylist(playlistId: string, userId: string): Promise<boolean> {
  const playlist = await db.query.playlists.findFirst({ where: eq(schema.playlists.id, playlistId) });
  if (!playlist) return false;
  if (playlist.visibility === "public") return true;
  if (playlist.ownerUserId === userId) return true;
  return userIsPlaylistMember(playlistId, userId);
}
