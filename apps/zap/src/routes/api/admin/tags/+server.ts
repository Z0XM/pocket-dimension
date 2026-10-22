import { json } from "@sveltejs/kit";
import { requireZapAdmin } from "$lib/server/admin/access";
import { listSystemTagsForAdmin } from "$lib/server/admin/tags";
import type { RequestHandler } from "./$types";

const PAGE_SIZE = 50;

/** Zap admin: paginated system tags. */
export const GET: RequestHandler = async ({ locals, url }) => {
  requireZapAdmin(locals);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? "0") || 0, 0);
  const limitRaw = Number(url.searchParams.get("limit") ?? String(PAGE_SIZE));
  const limit = Number.isFinite(limitRaw) ? limitRaw : PAGE_SIZE;
  const result = await listSystemTagsForAdmin({ offset, limit });
  return json(result);
};
