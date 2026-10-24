export const SONG_DELETE_CONFIRM_BODY =
  "Deletes the audio object from storage and removes the song from the catalogue, every library and tag, playlists, saved queues, live session queues and play history. This can't be undone.";

export const SONG_ARCHIVE_CONFIRM_BODY =
  "Hides the song from the catalogue, queues, playlists, and history for everyone. Admins can still find it under Admin → Songs and unarchive it later. The audio file stays in storage.";

export type SongDeleteResponse = {
  title: string;
  storageKey: string | null;
  storageDeleted: boolean;
  storageError: string | null;
};

export function describeSongDelete(body: SongDeleteResponse): string {
  if (!body.storageKey) return `Deleted "${body.title}" (it had no storage object).`;
  if (body.storageDeleted) return `Deleted "${body.title}" and its storage object.`;
  return `Deleted "${body.title}" from the catalogue, but the storage object couldn't be removed: ${body.storageError ?? "unknown error"}`;
}

export async function deleteSongAsAdmin(mediaAssetId: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`/api/admin/media/${encodeURIComponent(mediaAssetId)}`, {
      method: "DELETE",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    const body = (await res.json().catch(() => null)) as (SongDeleteResponse & { message?: string }) | null;
    if (!res.ok || !body) return { ok: false, message: body?.message ?? `Delete failed (${res.status})` };
    return { ok: true, message: describeSongDelete(body) };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Delete failed" };
  }
}

export async function archiveSongAsAdmin(mediaAssetId: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`/api/admin/media/${encodeURIComponent(mediaAssetId)}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive" }),
    });
    const body = (await res.json().catch(() => null)) as { title?: string; message?: string } | null;
    if (!res.ok || !body?.title) return { ok: false, message: body?.message ?? `Archive failed (${res.status})` };
    return { ok: true, message: `Archived "${body.title}".` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Archive failed" };
  }
}

export async function unarchiveSongAsAdmin(mediaAssetId: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`/api/admin/media/${encodeURIComponent(mediaAssetId)}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unarchive" }),
    });
    const body = (await res.json().catch(() => null)) as { title?: string; status?: string; message?: string } | null;
    if (!res.ok || !body?.title) return { ok: false, message: body?.message ?? `Unarchive failed (${res.status})` };
    return { ok: true, message: `Restored "${body.title}" (${body.status ?? "ready"}).` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Unarchive failed" };
  }
}
