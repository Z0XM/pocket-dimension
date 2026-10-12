import { error, redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { SessionError, getSessionForUser } from "$lib/server/sessions";
import { listAvailableTags, listCatalogue, serializeCatalogueAsset, CATALOGUE_PAGE_SIZE } from "$lib/server/catalogue";

export const load: PageServerLoad = async ({ locals, params, url }) => {
  if (!locals.user) throw redirect(307, `/login?redirect=${encodeURIComponent(url.pathname)}`);
  if (!locals.user.emailVerified) throw redirect(307, "/check-email?reason=verify");

  try {
    const snapshot = await getSessionForUser(params.id, locals.user.id);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const scope = url.searchParams.get("scope") === "yours" ? "yours" : "all";
    const selectedTagIds = url.searchParams.getAll("tag").filter(Boolean);

    const [{ assets, tagsByAsset, hasMore, nextOffset }, availableTags] = await Promise.all([
      listCatalogue({
        userId: locals.user.id,
        scope,
        q,
        tagIds: selectedTagIds,
        limit: CATALOGUE_PAGE_SIZE,
        offset: 0,
      }),
      listAvailableTags(locals.user.id),
    ]);

    return {
      snapshot,
      catalogue: assets.map((a) => serializeCatalogueAsset(a, tagsByAsset.get(a.id) ?? [])),
      catalogueHasMore: hasMore,
      catalogueNextOffset: nextOffset,
      cataloguePageSize: CATALOGUE_PAGE_SIZE,
      availableTags,
      catalogueQ: q,
      catalogueScope: scope,
      selectedTagIds,
    };
  } catch (err) {
    if (err instanceof SessionError) {
      if (err.status === 403) throw redirect(307, `/join?code=`);
      throw error(err.status, err.message);
    }
    throw err;
  }
};
