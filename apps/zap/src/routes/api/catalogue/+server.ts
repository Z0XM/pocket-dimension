import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { CATALOGUE_PAGE_SIZE, listAvailableTags, listCatalogue, serializeCatalogueAsset } from "$lib/server/catalogue";

export const GET: RequestHandler = async ({ locals, url }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  const scope = url.searchParams.get("scope") === "yours" ? "yours" : "all";
  const q = url.searchParams.get("q") ?? "";
  const tagIds = url.searchParams.getAll("tag").filter(Boolean);
  const tagQuery = url.searchParams.get("tq") ?? "";
  const offset = Number(url.searchParams.get("offset") ?? "0");
  const limit = Number(url.searchParams.get("limit") ?? String(CATALOGUE_PAGE_SIZE));

  const { assets, tagsByAsset, hasMore, nextOffset, tagQueryError } = await listCatalogue({
    userId: locals.user.id,
    scope,
    q,
    tagIds: tagQuery.trim() ? [] : tagIds,
    tagQuery,
    offset: Number.isFinite(offset) ? offset : 0,
    limit: Number.isFinite(limit) ? limit : CATALOGUE_PAGE_SIZE,
  });

  return json({
    scope,
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
  const tags = await listAvailableTags(locals.user.id);
  return json({
    availableTags: tags.map((t) => ({ id: t.id, name: t.name, kind: t.kind })),
  });
};
