import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { IngestError, ingestPublicUrl, resolveYtDlpBin } from "$lib/server/ingest";
import { isStorageConfigured } from "$lib/server/storage";

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");
  if (!isStorageConfigured()) throw error(503, "Object storage is not configured");
  if (!(await resolveYtDlpBin())) throw error(503, "yt-dlp is not installed");

  const body = (await request.json().catch(() => ({}))) as { url?: string };
  const url = String(body.url ?? "").trim();
  if (!url) throw error(400, "Paste a public song or playlist URL.");

  const userId = locals.user.id;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };
      try {
        const result = await ingestPublicUrl(userId, url, (song) => {
          send({ type: "song", ...song });
        });
        send({
          type: "done",
          imported: result.imported,
          skipped: result.skipped,
          failed: result.failed,
          syncRunId: result.syncRunId,
          errorMessage: result.errorMessage ?? null,
          failures: result.failures ?? [],
        });
      } catch (err) {
        console.error("[zap ingest url]", err);
        send({
          type: "error",
          message: err instanceof IngestError || err instanceof Error ? err.message : "Ingest failed",
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
