import { json } from "@sveltejs/kit";
import { requireZapAdmin } from "$lib/server/admin/access";
import { ADMIN_SONG_STATUSES, listSongsForAdmin, type AdminSongStatus } from "$lib/server/admin/media";
import type { RequestHandler } from "./$types";

const PAGE_SIZE = 50;

/** Zap admin: paginated catalogue songs. */
export const GET: RequestHandler = async ({ locals, url }) => {
  requireZapAdmin(locals);
  const q = url.searchParams.get("q") ?? "";
  const statusParam = url.searchParams.get("status") ?? "";
  const status = (ADMIN_SONG_STATUSES as readonly string[]).includes(statusParam) ? (statusParam as AdminSongStatus) : null;
  const offset = Math.max(Number(url.searchParams.get("offset") ?? "0") || 0, 0);
  const limitRaw = Number(url.searchParams.get("limit") ?? String(PAGE_SIZE));
  const limit = Number.isFinite(limitRaw) ? limitRaw : PAGE_SIZE;
  const result = await listSongsForAdmin({ q, status, offset, limit });
  return json(result);
};
