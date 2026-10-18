import { error, redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { parseCatalogueScope } from "$lib/catalogue-scope";
import { SessionError, getSessionForUser } from "$lib/server/sessions";
import { listCatalogue, listTagFilterOptions, serializeCatalogueAsset, CATALOGUE_PAGE_SIZE } from "$lib/server/catalogue";

export const load: PageServerLoad = async ({ locals, params, url }) => {
  if (!locals.user) throw redirect(307, `/login?redirect=${encodeURIComponent(url.pathname)}`);
  if (!locals.user.emailVerified) throw redirect(307, "/check-email?reason=verify");

  try {
    const snapshot = await getSessionForUser(params.id, locals.user.id);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const { scope, playlistId } = parseCatalogueScope(url.searchParams, "yours");
    const selectedTagIds = url.searchParams.getAll("tag").filter(Boolean);
    const tagQuery = url.searchParams.get("tq") ?? "";
    const catalogueLibraryScope = scope === "playlist" && playlistId ? `playlist:${playlistId}` : scope === "all" ? "all" : "";

    const [{ assets, tagsByAsset, hasMore, nextOffset, tagQueryError }, tagOptions, playlists] = await Promise.all([
      listCatalogue({
        userId: locals.user.id,
        scope,
        playlistId,
        q,
        tagIds: tagQuery.trim() ? [] : selectedTagIds,
        tagQuery,
        limit: CATALOGUE_PAGE_SIZE,
        offset: 0,
      }),
      listTagFilterOptions(locals.user.id),
      import("$lib/server/playlists").then((m) => m.listPlaylistsForUser(locals.user!.id)),
    ]);

    return {
      snapshot,
      catalogue: assets.map((a) => serializeCatalogueAsset(a, tagsByAsset.get(a.id) ?? [])),
      catalogueHasMore: hasMore,
      catalogueNextOffset: nextOffset,
      cataloguePageSize: CATALOGUE_PAGE_SIZE,
      availableTags: tagOptions.availableTags,
      topTagIds: tagOptions.topTagIds,
      catalogueQ: q,
      catalogueLibraryScope,
      selectedTagIds,
      catalogueTagQuery: tagQuery,
      catalogueTagQueryError: tagQueryError ?? null,
      playlists: playlists.map((p) => ({ id: p.id, name: p.name, trackCount: p.trackCount })),
    };
  } catch (err) {
    if (err instanceof SessionError) {
      if (err.status === 403) throw redirect(307, `/join?code=`);
      throw error(err.status, err.message);
    }
    throw err;
  }
};
