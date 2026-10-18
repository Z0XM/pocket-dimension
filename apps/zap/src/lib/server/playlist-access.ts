import { db, schema } from "@pocket-dimension/db";
import { and, eq } from "drizzle-orm";

export async function userCanEditPlaylist(playlistId: string, userId: string): Promise<boolean> {
  const playlist = await db.query.playlists.findFirst({ where: eq(schema.playlists.id, playlistId) });
  if (!playlist) return false;
  if (playlist.ownerUserId === userId) return true;
  const member = await db.query.playlistMembers.findFirst({
    where: and(eq(schema.playlistMembers.playlistId, playlistId), eq(schema.playlistMembers.userId, userId)),
  });
  return Boolean(member);
}

export async function userCanViewPlaylist(playlistId: string, userId: string): Promise<boolean> {
  const playlist = await db.query.playlists.findFirst({ where: eq(schema.playlists.id, playlistId) });
  if (!playlist) return false;
  if (playlist.visibility === "public") return true;
  if (playlist.ownerUserId === userId) return true;
  const member = await db.query.playlistMembers.findFirst({
    where: and(eq(schema.playlistMembers.playlistId, playlistId), eq(schema.playlistMembers.userId, userId)),
  });
  return Boolean(member);
}
