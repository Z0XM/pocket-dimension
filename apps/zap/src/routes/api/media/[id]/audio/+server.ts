import { error } from "@sveltejs/kit";
import { db, schema } from "@pocket-dimension/db";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "./$types";
import { getStorageConfig } from "$lib/server/storage";

/**
 * Same-origin audio stream for library playback (avoids R2 browser CORS setup).
 * Auth: signed-in verified user. Source: R2 via Bun.S3Client.
 */
export const GET: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  const id = params.id?.trim();
  if (!id) throw error(400, "Missing asset id");

  const asset = await db.query.mediaAssets.findFirst({
    where: eq(schema.mediaAssets.id, id),
  });
  if (!asset || asset.status !== "ready" || !asset.storageKey) {
    throw error(404, "Track not found");
  }

  const config = getStorageConfig();
  if (!config) throw error(503, "Object storage is not configured");

  const client = new Bun.S3Client({
    accessKeyId: config.accessKey,
    secretAccessKey: config.secretKey,
    bucket: config.bucket,
    endpoint: config.endpoint,
    region: config.region || "auto",
    virtualHostedStyle: config.virtualHostedStyle,
  });

  const file = client.file(asset.storageKey);
  const contentType = asset.codec || "audio/mpeg";

  // Support Range requests for seek
  const range = request.headers.get("range");
  try {
    if (range) {
      const size = await file.size;
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      if (!match) throw error(416, "Invalid range");
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : Math.max(size - 1, 0);
      if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
        throw error(416, "Invalid range");
      }
      const chunk = file.slice(start, end + 1);
      const buf = await chunk.arrayBuffer();
      return new Response(buf, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(buf.byteLength),
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, max-age=60",
        },
      });
    }

    const buf = await file.arrayBuffer();
    return new Response(buf, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buf.byteLength),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (err) {
    if (err && typeof err === "object" && "status" in err) throw err;
    console.error("[zap audio]", err);
    throw error(502, err instanceof Error ? err.message : "Failed to read audio from storage");
  }
};
