import { fail } from "@sveltejs/kit";
import { db, schema } from "@pocket-dimension/db";
import { eq } from "drizzle-orm";
import type { Actions, PageServerLoad } from "./$types";
import { readCustomTagNamesFromForm } from "$lib/custom-tags";
import {
  CATALOGUE_PAGE_SIZE,
  ensureCustomTags,
  isCatalogueVisibleStatus,
  listAvailableTags,
  listCatalogue,
  serializeCatalogueAsset,
  setUserAssetTags,
} from "$lib/server/catalogue";
import { resolveYtDlpBin } from "$lib/server/ingest";
import { isStorageConfigured } from "$lib/server/storage";
import { listSuggestionsFromOthers } from "$lib/server/suggestions";
import { getYoutubeLinkStatus, isGoogleOAuthConfigured } from "$lib/server/youtube";

function readTagIds(form: FormData): string[] {
  return form
    .getAll("tagIds")
    .map((v) => String(v).trim())
    .filter(Boolean);
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const userId = locals.user!.id;

  const scope = url.searchParams.get("scope") === "yours" ? "yours" : "all";
  const q = url.searchParams.get("q") ?? "";
  const tagIds = url.searchParams.getAll("tag").filter(Boolean);
  const tagQuery = url.searchParams.get("tq") ?? "";

  const [{ assets, tagsByAsset, hasMore, nextOffset, tagQueryError }, availableTags, suggestions, ytDlpBin, youtubeLink] = await Promise.all([
    listCatalogue({
      userId,
      scope,
      q,
      tagIds: tagQuery.trim() ? [] : tagIds,
      tagQuery,
      offset: 0,
      limit: CATALOGUE_PAGE_SIZE,
    }),
    listAvailableTags(userId),
    listSuggestionsFromOthers(userId, 12),
    resolveYtDlpBin(),
    getYoutubeLinkStatus(userId).catch(() => ({ linked: false as const })),
  ]);

  const storageReady = isStorageConfigured();
  const ytDlpReady = Boolean(ytDlpBin);

  return {
    scope,
    q,
    selectedTagIds: tagIds,
    tagQuery,
    tagQueryError: tagQueryError ?? null,
    pageSize: CATALOGUE_PAGE_SIZE,
    hasMore,
    nextOffset,
    availableTags: availableTags.map((t) => ({ id: t.id, name: t.name, kind: t.kind })),
    assets: assets.map((asset) => serializeCatalogueAsset(asset, tagsByAsset.get(asset.id) ?? [])),
    suggestions,
    addMusic: {
      storageReady,
      ingestReady: storageReady && ytDlpReady,
      ytDlpReady,
      youtubeOauthConfigured: isGoogleOAuthConfigured(),
      youtubeLinked: youtubeLink.linked,
      youtubeLinkedAt: youtubeLink.linked ? youtubeLink.linkedAt : null,
    },
  };
};

export const actions: Actions = {
  setTags: async ({ request, locals }) => {
    const userId = locals.user!.id;
    const form = await request.formData();
    const mediaAssetId = String(form.get("mediaAssetId") ?? "").trim();
    const tagIds = readTagIds(form);
    const customTagNames = readCustomTagNamesFromForm(form);

    if (!mediaAssetId) return fail(400, { tagError: "Missing track." });

    const asset = await db.query.mediaAssets.findFirst({
      where: eq(schema.mediaAssets.id, mediaAssetId),
    });
    if (!asset || !isCatalogueVisibleStatus(asset.status)) return fail(404, { tagError: "Track not found." });

    const nextTagIds = [...tagIds, ...(await ensureCustomTags(userId, customTagNames))];

    await setUserAssetTags(userId, mediaAssetId, nextTagIds);
    return { tagOk: true, mediaAssetId };
  },
};
