import { fail } from "@sveltejs/kit";
import { createHash } from "node:crypto";
import { db, schema } from "@pocket-dimension/db";
import { and, eq } from "drizzle-orm";
import type { Actions, PageServerLoad } from "./$types";
import { ensureSystemTags, listAvailableTags, listCatalogue } from "$lib/server/catalogue";
import { isStorageConfigured, putMediaObject } from "$lib/server/storage";

const MAX_DURATION_MS = 10 * 60 * 1000;

export const load: PageServerLoad = async ({ locals, url }) => {
  const userId = locals.user!.id;
  await ensureSystemTags();

  const scope = url.searchParams.get("scope") === "yours" ? "yours" : "all";
  const q = url.searchParams.get("q") ?? "";
  const tagIds = url.searchParams.getAll("tag").filter(Boolean);

  const [{ assets, tagsByAsset }, availableTags] = await Promise.all([listCatalogue({ userId, scope, q, tagIds }), listAvailableTags(userId)]);

  return {
    scope,
    q,
    selectedTagIds: tagIds,
    storageReady: isStorageConfigured(),
    availableTags: availableTags.map((t) => ({ id: t.id, name: t.name, kind: t.kind })),
    assets: assets.map((asset) => ({
      id: asset.id,
      title: asset.title,
      artists: asset.artists,
      durationMs: asset.durationMs,
      sourceType: asset.sourceType,
      tags: (tagsByAsset.get(asset.id) ?? []).map((t: { id: string; name: string; kind: string }) => ({
        id: t.id,
        name: t.name,
        kind: t.kind,
      })),
    })),
  };
};

export const actions: Actions = {
  upload: async ({ request, locals }) => {
    const userId = locals.user!.id;
    const form = await request.formData();
    const file = form.get("file");
    const title = String(form.get("title") ?? "").trim();
    const tagId = String(form.get("tagId") ?? "").trim();

    if (!(file instanceof File) || file.size === 0) {
      return fail(400, { uploadError: "Choose an audio file." });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const hash = createHash("sha256").update(bytes).digest("hex");
    const identityKey = `upload:${hash}`;

    // Duration probe deferred (ffprobe in fat image). Accept upload; client may omit duration.
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

    if (tagId) {
      const tag = await db.query.tags.findFirst({
        where: and(eq(schema.tags.id, tagId), eq(schema.tags.kind, "system")),
      });
      if (tag) {
        await db.insert(schema.mediaAssetTags).values({ userId, mediaAssetId: asset.id, tagId: tag.id }).onConflictDoNothing();
      }
    }

    return { uploadOk: true };
  },
};
