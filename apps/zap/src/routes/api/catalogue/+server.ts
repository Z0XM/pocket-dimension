import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { CATALOGUE_PAGE_SIZE, listCatalogue, listTagFilterOptions, parseCatalogueScope, serializeCatalogueAsset } from "$lib/server/catalogue";
import { userCanViewPlaylist } from "$lib/server/playlist-access";

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  const { scope, playlistId } = parseCatalogueScope(url.searchParams, "all");
  if (playlistId && !(await userCanViewPlaylist(playlistId, locals.user.id))) throw error(404, "Playlist not found");
  const q = url.searchParams.get("q") ?? "";
  const tagIds = url.searchParams.getAll("tag").filter(Boolean);
  const tagQuery = url.searchParams.get("tq") ?? "";
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const limit = Number(url.searchParams.get("limit") ?? String(CATALOGUE_PAGE_SIZE));

  const { assets, tagsByAsset, hasMore, nextOffset, tagQueryError } = await listCatalogue({
    userId: locals.user.id,
    scope,
    playlistId,
    q,
    tagIds: tagQuery.trim() ? [] : tagIds,
    tagQuery,
    offset: Number.isFinite(offset) ? offset : 0,
    limit: Number.isFinite(limit) ? limit : CATALOGUE_PAGE_SIZE,
  });

  return json({
    scope,
    playlistId,
    q,
    selectedTagIds: tagIds,
    tagQuery,
    tagQueryError: tagQueryError ?? null,
    hasMore,
    nextOffset,
    assets: assets.map((asset) => serializeCatalogueAsset(asset, tagsByAsset.get(asset.id) ?? [])),
  });
};

/** Optional helper for clients that need tags without a full page load. */
export const POST: RequestHandler = async ({ locals }) => {
  if (!locals.user) throw error(401, "Sign in required");
  return json(await listTagFilterOptions(locals.user.id));
};
