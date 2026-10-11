import { error } from "@sveltejs/kit";
import { db, schema } from "@pocket-dimension/db";
import { eq } from "drizzle-orm";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { RequestHandler } from "./$types";
import { parseBytesRange } from "$lib/server/byte-range";
import { getStorageConfig } from "$lib/server/storage";

/** Local fixture for play/pause tests without R2 (`storage_key = fixture:local`). */
function readFixtureLocal(): { buf: ArrayBuffer; contentType: string; size: number } {
  const path = join(process.cwd(), "static", "fixture.wav");
  const size = statSync(path).size;
  const nodeBuf = readFileSync(path);
  return {
    buf: nodeBuf.buffer.slice(nodeBuf.byteOffset, nodeBuf.byteOffset + nodeBuf.byteLength),
    contentType: "audio/wav",
    size,
  };
}

function createClient() {
  const config = getStorageConfig();
  if (!config) return null;
  return {
    config,
    client: new Bun.S3Client({
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
      bucket: config.bucket,
      endpoint: config.endpoint,
      region: config.region || "auto",
      virtualHostedStyle: config.virtualHostedStyle,
    }),
  };
}

async function resolveObjectSize(client: Bun.S3Client, storageKey: string, file: Bun.S3File): Promise<number> {
  // Do NOT use file.size — on S3File it is the Blob sync getter and is often 0 before HEAD,
  // which made `Range: bytes=0-` incorrectly 416.
  try {
    const stats = await file.stat();
    if (stats?.size && Number.isFinite(stats.size) && stats.size > 0) return stats.size;
  } catch {
    // fall through
  }
  try {
    const n = await client.size(storageKey);
    if (Number.isFinite(n) && n > 0) return n;
  } catch {
    // fall through
  }
  return 0;
}

function fullResponse(body: ArrayBuffer, contentType: string) {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(body.byteLength),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=60",
    },
  });
}

function partialResponse(body: ArrayBuffer, contentType: string, start: number, end: number, size: number) {
  return new Response(body, {
    status: 206,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(body.byteLength),
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=60",
    },
  });
}

/**
 * Same-origin audio stream for library playback (avoids R2 browser CORS setup).
 * Supports Range so HTML5 <audio> can play + seek.
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

  const rangeHeader = request.headers.get("range");
  const storageKey = asset.storageKey;

  // Local fixture path (no R2) — used for play/pause/seek verification
  if (storageKey === "fixture:local") {
    try {
      const fixture = readFixtureLocal();
      const parsed = parseBytesRange(rangeHeader, fixture.size);
      if (parsed.type === "full") return fullResponse(fixture.buf, fixture.contentType);
      if (parsed.type === "unsatisfiable") {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${fixture.size}`, "Accept-Ranges": "bytes" },
        });
      }
      const slice = fixture.buf.slice(parsed.start, parsed.end + 1);
      return partialResponse(slice, fixture.contentType, parsed.start, parsed.end, fixture.size);
    } catch (err) {
      console.error("[zap audio fixture]", err);
      throw error(500, "Fixture audio missing — run static/fixture.wav setup");
    }
  }

  const wired = createClient();
  if (!wired) throw error(503, "Object storage is not configured");

  const { client } = wired;
  const file = client.file(storageKey);
  const contentType = asset.codec?.includes("/") ? asset.codec : "audio/mpeg";

  try {
    const size = await resolveObjectSize(client, storageKey, file);
    const parsed = parseBytesRange(rangeHeader, size);

    // Unknown/empty size: always download full object and serve 200 (never 416).
    if (size <= 0 || parsed.type === "full") {
      const buf = await file.arrayBuffer();
      return fullResponse(buf, contentType);
    }

    if (parsed.type === "unsatisfiable") {
      // RFC 7233: include Content-Range: bytes */size on 416
      return new Response(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${size}`,
          "Accept-Ranges": "bytes",
        },
      });
    }

    const { start, end } = parsed;
    try {
      // Bun S3File.slice end is exclusive (Blob semantics)
      const chunk = file.slice(start, end + 1, contentType);
      const buf = await chunk.arrayBuffer();
      if (buf.byteLength === 0 && size > 0) {
        // Upstream returned empty for a valid range — fall back to full body
        const full = await file.arrayBuffer();
        return fullResponse(full, contentType);
      }
      // If upstream returned a different length, still advertise the requested range
      // but use actual bytes for Content-Length.
      const actualEnd = start + buf.byteLength - 1;
      return partialResponse(buf, contentType, start, actualEnd >= start ? actualEnd : end, size);
    } catch (sliceErr) {
      console.warn("[zap audio] range slice failed, falling back to full body", sliceErr);
      const full = await file.arrayBuffer();
      return fullResponse(full, contentType);
    }
  } catch (err) {
    if (err && typeof err === "object" && "status" in err) throw err;
    console.error("[zap audio]", err);
    throw error(502, err instanceof Error ? err.message : "Failed to read audio from storage");
  }
};
