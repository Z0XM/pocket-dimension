export type PlaylistDeleteAccess = "allowed" | "forbidden" | "not_found";

/**
 * Only the owner deletes (collaborators edit tracks but, like visibility and membership, deletion is owner-only).
 * Playlists the user cannot even view report `not_found` so private ids are not confirmed to exist.
 */
export function playlistDeleteAccess(
  playlist: { ownerUserId: string; visibility: "private" | "public" } | null | undefined,
  userId: string,
  isMember: boolean
): PlaylistDeleteAccess {
  if (!playlist) return "not_found";
  if (playlist.ownerUserId === userId) return "allowed";
  if (playlist.visibility === "public" || isMember) return "forbidden";
  return "not_found";
}
