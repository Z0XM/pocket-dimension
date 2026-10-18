import { requireZapAdmin } from "$lib/server/admin/access";
import { ADMIN_SONG_STATUSES, listSongsForAdmin, type AdminSongStatus } from "$lib/server/admin/media";
import { isStorageConfigured } from "$lib/server/storage";
import type { PageServerLoad } from "./$types";

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ locals, url }) => {
  requireZapAdmin(locals);
  const q = url.searchParams.get("q") ?? "";
  const statusParam = url.searchParams.get("status") ?? "";
  const status = (ADMIN_SONG_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as AdminSongStatus) : null;
  const offset = Math.max(Number(url.searchParams.get("offset") ?? "0") || 0, 0);

  const result = await listSongsForAdmin({ q, status, offset, limit: PAGE_SIZE });
  return {
    ...result,
    offset,
    pageSize: PAGE_SIZE,
    filters: { q, status: status ?? "" },
    storageConfigured: isStorageConfigured(),
  };
};
