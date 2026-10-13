import { fail } from "@sveltejs/kit";
import { createHash } from "node:crypto";
import { db, schema } from "@pocket-dimension/db";
import { eq } from "drizzle-orm";
import type { Actions, PageServerLoad } from "./$types";
import { ensureCustomTag, ensureSystemTags, listAvailableTags, setUserAssetTags } from "$lib/server/catalogue";
import { IngestError, ingestPublicUrl, resolveYtDlpBin } from "$lib/server/ingest";
import { MAX_TRACK_DURATION_MS } from "$lib/server/ingest/limits";
import { describeStorageConfig, isStorageConfigured, putMediaObject } from "$lib/server/storage";
import { getYoutubeLinkStatus, isGoogleOAuthConfigured } from "$lib/server/youtube";

const MAX_DURATION_MS = MAX_TRACK_DURATION_MS;

function readTagIds(form: FormData): string[] {
  return form
    .getAll("tagIds")
    .map((v) => String(v).trim())
    .filter(Boolean);
}

export const load: PageServerLoad = async ({ locals }) => {
  const userId = locals.user!.id;
  await ensureSystemTags();
  const availableTags = await listAvailableTags(userId);
  const ytDlpReady = Boolean(await resolveYtDlpBin());
  const storageReady = isStorageConfigured();
  const youtubeOauthConfigured = isGoogleOAuthConfigured();
  const youtubeLink = await getYoutubeLinkStatus(userId).catch(() => ({ linked: false as const }));

  return {
    storageReady,
    ingestReady: storageReady && ytDlpReady,
    ytDlpReady,
    storageInfo: describeStorageConfig(),
    youtubeOauthConfigured,
    youtubeLinked: youtubeLink.linked,
    youtubeLinkedAt: youtubeLink.linked ? youtubeLink.linkedAt : null,
    availableTags: availableTags.map((t) => ({ id: t.id, name: t.name, kind: t.kind })),
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
          errorMessage: result.errorMessage ?? null,
          failures: (result.failures ?? []).slice(0, 8).map((f) => ({
            title: f.title ?? null,
            reason: f.reason,
          })),
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
