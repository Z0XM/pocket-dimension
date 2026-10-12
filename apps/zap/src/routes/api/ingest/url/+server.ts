import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { IngestError, ingestPublicUrl, resolveYtDlpBin } from "$lib/server/ingest";
import { isStorageConfigured } from "$lib/server/storage";

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  if (!isStorageConfigured()) {
    throw error(503, "Object storage is not configured — set R2 env for URL ingest");
  }
  if (!(await resolveYtDlpBin())) {
    throw error(503, "yt-dlp is not installed on this Zap instance");
  }

  const body = (await request.json().catch(() => ({}))) as { url?: string };
  const url = body.url?.trim() ?? "";
  if (!url) throw error(400, "url required");

  try {
    const result = await ingestPublicUrl(locals.user.id, url);
    return json(result);
  } catch (err) {
    if (err instanceof IngestError) throw error(err.status, err.message);
    console.error("[zap ingest]", err);
    throw error(502, err instanceof Error ? err.message : "Ingest failed");
  }
};
