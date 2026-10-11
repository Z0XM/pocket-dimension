import { fail } from "@sveltejs/kit";
import { createHash } from "node:crypto";
import { db, schema } from "@pocket-dimension/db";
import { eq } from "drizzle-orm";
import type { Actions, PageServerLoad } from "./$types";
import {
  CATALOGUE_PAGE_SIZE,
  ensureCustomTag,
  ensureSystemTags,
  listAvailableTags,
  listCatalogue,
  serializeCatalogueAsset,
  setUserAssetTags,
} from "$lib/server/catalogue";
import { IngestError, ingestPublicUrl, resolveYtDlpBin } from "$lib/server/ingest";
import { MAX_TRACK_DURATION_MS } from "$lib/server/ingest/limits";
import { describeStorageConfig, isStorageConfigured, putMediaObject } from "$lib/server/storage";

const MAX_DURATION_MS = MAX_TRACK_DURATION_MS;

function readTagIds(form: FormData): string[] {
  return form
    .getAll("tagIds")
    .map((v) => String(v).trim())
    .filter(Boolean);
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const userId = locals.user!.id;
  await ensureSystemTags();

  const scope = url.searchParams.get("scope") === "yours" ? "yours" : "all";
  const q = url.searchParams.get("q") ?? "";
  const tagIds = url.searchParams.getAll("tag").filter(Boolean);

  const [{ assets, tagsByAsset, hasMore, nextOffset }, availableTags] = await Promise.all([
    listCatalogue({ userId, scope, q, tagIds, offset: 0, limit: CATALOGUE_PAGE_SIZE }),
    listAvailableTags(userId),
  ]);

  const ytDlpReady = Boolean(await resolveYtDlpBin());
  const storageReady = isStorageConfigured();

  return {
    scope,
    q,
    selectedTagIds: tagIds,
    pageSize: CATALOGUE_PAGE_SIZE,
    hasMore,
    nextOffset,
    storageReady,
    ingestReady: storageReady && ytDlpReady,
    ytDlpReady,
    storageInfo: describeStorageConfig(),
    availableTags: availableTags.map((t) => ({ id: t.id, name: t.name, kind: t.kind })),
    assets: assets.map((asset) => serializeCatalogueAsset(asset, tagsByAsset.get(asset.id) ?? [])),
  };
};

export const actions: Actions = {
  upload: async ({ request, locals }) => {
    const userId = locals.user!.id;
    const form = await request.formData();
    const file = form.get("file");
    const title = String(form.get("title") ?? "").trim();
    const tagIds = readTagIds(form);
    const customTagName = String(form.get("customTag") ?? "").trim();

    if (!(file instanceof File) || file.size === 0) {
      return fail(400, { uploadError: "Choose an audio file." });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const hash = createHash("sha256").update(bytes).digest("hex");
    const identityKey = `upload:${hash}`;

    const durationRaw = String(form.get("durationMs") ?? "").trim();
    const durationMs = durationRaw ? Number(durationRaw) : null;
    if (durationMs != null && Number.isFinite(durationMs) && durationMs > MAX_DURATION_MS) {
      return fail(400, { uploadError: "Zap only allows tracks up to 10 minutes." });
    }

    let asset = await db.query.mediaAssets.findFirst({
      where: eq(schema.mediaAssets.identityKey, identityKey),
    });

    if (!asset) {
      let storageKey: string | null = null;
      try {
        const put = await putMediaObject({
          identityKey,
          body: bytes,
          contentType: file.type || "audio/mpeg",
          ext: file.name.split(".").pop() || "mp3",
        });
        storageKey = put.storageKey;
      } catch (err) {
        return fail(503, {
          uploadError: err instanceof Error ? err.message : "Storage unavailable.",
        });
      }

      const [inserted] = await db
        .insert(schema.mediaAssets)
        .values({
          identityKey,
          sourceType: "upload",
          status: "ready",
          storageKey,
          title: title || file.name.replace(/\.[^.]+$/, "") || "Untitled",
          artists: null,
          durationMs: durationMs && Number.isFinite(durationMs) ? Math.round(durationMs) : null,
          codec: file.type || null,
          addedByUserId: userId,
        })
        .returning();
      asset = inserted;
    }

    const nextTagIds = [...tagIds];
    if (customTagName) {
      const custom = await ensureCustomTag(userId, customTagName);
      if (custom) nextTagIds.push(custom.id);
    }
    if (nextTagIds.length > 0) {
      await setUserAssetTags(userId, asset.id, nextTagIds);
    }

    return { uploadOk: true };
  },

  setTags: async ({ request, locals }) => {
    const userId = locals.user!.id;
    const form = await request.formData();
    const mediaAssetId = String(form.get("mediaAssetId") ?? "").trim();
    const tagIds = readTagIds(form);
    const customTagName = String(form.get("customTag") ?? "").trim();

    if (!mediaAssetId) {
      return fail(400, { tagError: "Missing track." });
    }

    const asset = await db.query.mediaAssets.findFirst({
      where: eq(schema.mediaAssets.id, mediaAssetId),
    });
    if (!asset || asset.status !== "ready") {
      return fail(404, { tagError: "Track not found." });
    }

    const nextTagIds = [...tagIds];
    if (customTagName) {
      const custom = await ensureCustomTag(userId, customTagName);
      if (custom) nextTagIds.push(custom.id);
    }

    await setUserAssetTags(userId, mediaAssetId, nextTagIds);
    return { tagOk: true, mediaAssetId };
  },

  ingestUrl: async ({ request, locals }) => {
    const userId = locals.user!.id;
    const form = await request.formData();
    const url = String(form.get("url") ?? "").trim();
    if (!url) {
      return fail(400, { ingestError: "Paste a public song or playlist URL." });
    }

    try {
      const result = await ingestPublicUrl(userId, url);
      return {
        ingestOk: true,
        ingestSummary: {
          imported: result.imported,
          skipped: result.skipped,
          failed: result.failed,
          syncRunId: result.syncRunId,
        },
      };
    } catch (err) {
      if (err instanceof IngestError) {
        return fail(err.status, { ingestError: err.message });
      }
      console.error("[zap ingestUrl]", err);
      return fail(502, { ingestError: err instanceof Error ? err.message : "Ingest failed" });
    }
  },
};
