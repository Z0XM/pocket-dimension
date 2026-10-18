import { error } from "@sveltejs/kit";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "./$types";
import { db, schema } from "@pocket-dimension/db";
import { readCustomTagNamesFromForm } from "$lib/custom-tags";
import { ensureCustomTags, setUserAssetTags } from "$lib/server/catalogue";
import { MAX_TRACK_DURATION_MS } from "$lib/server/ingest/limits";
import { isStorageConfigured, putMediaObject } from "$lib/server/storage";

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");
  if (!isStorageConfigured()) throw error(503, "Object storage is not configured");

  const form = await request.formData();
  const file = form.get("file");
  const title = String(form.get("title") ?? "").trim();
  const tagIds = form
    .getAll("tagIds")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const customTagNames = readCustomTagNamesFromForm(form);
  const durationRaw = String(form.get("durationMs") ?? "").trim();
  const durationMs = durationRaw ? Number(durationRaw) : null;

  if (!(file instanceof File) || file.size === 0) {
    throw error(400, "Choose an audio file.");
  }
  if (durationMs != null && Number.isFinite(durationMs) && durationMs > MAX_TRACK_DURATION_MS) {
    throw error(400, "Zap only allows tracks up to 10 minutes.");
  }

  const userId = locals.user.id;
  const displayTitle = title || file.name.replace(/\.[^.]+$/, "") || "Untitled";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        // Client already transferred the file in this request body; treat that as download=100.
        send({
          type: "song",
          identityKey: "upload:pending",
          title: displayTitle,
          phase: "downloading",
          percent: 100,
        });

        const bytes = new Uint8Array(await file.arrayBuffer());
        const hash = createHash("sha256").update(bytes).digest("hex");
        const identityKey = `upload:${hash}`;

        let asset = await db.query.mediaAssets.findFirst({
          where: eq(schema.mediaAssets.identityKey, identityKey),
        });

        if (!asset) {
          send({
            type: "song",
            identityKey,
            title: displayTitle,
            phase: "uploading",
            percent: 0,
          });
          const put = await putMediaObject({
            identityKey,
            body: bytes,
            contentType: file.type || "audio/mpeg",
            ext: file.name.split(".").pop() || "mp3",
            onUploadPercent: (percent) => {
              send({
                type: "song",
                identityKey,
                title: displayTitle,
                phase: "uploading",
                percent,
              });
            },
          });

          const [inserted] = await db
            .insert(schema.mediaAssets)
            .values({
              identityKey,
              sourceType: "upload",
              status: "ready",
              storageKey: put.storageKey,
              title: displayTitle,
              artists: null,
              durationMs: durationMs && Number.isFinite(durationMs) ? Math.round(durationMs) : null,
              codec: file.type || null,
              addedByUserId: userId,
            })
            .returning();
          asset = inserted!;
        }

        const nextTagIds = [...tagIds, ...(await ensureCustomTags(userId, customTagNames))];
        if (nextTagIds.length > 0) {
          await setUserAssetTags(userId, asset.id, nextTagIds);
        }

        send({
          type: "song",
          identityKey,
          title: asset.title,
          phase: "done",
          percent: 100,
        });
        send({ type: "done", mediaAssetId: asset.id, title: asset.title });
      } catch (err) {
        console.error("[zap ingest upload]", err);
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Upload failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
};
