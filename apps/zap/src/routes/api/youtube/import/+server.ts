import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { readCustomTagNamesFromJson } from "$lib/custom-tags";
import { getYoutubeLinkStatus, importConnectedPlaylists } from "$lib/server/youtube";
import { isStorageConfigured } from "$lib/server/storage";
import { resolveYtDlpBin } from "$lib/server/ingest";

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  const status = await getYoutubeLinkStatus(locals.user.id);
  if (!status.linked) throw error(403, "Connect YouTube first");
  if (!isStorageConfigured()) throw error(503, "Object storage is not configured");
  if (!(await resolveYtDlpBin())) throw error(503, "yt-dlp is not installed");

  const body = (await request.json().catch(() => ({}))) as {
    playlistIds?: string[];
    tagIds?: string[];
    customTag?: string;
    customTags?: string[];
    sort?: string;
  };
  const playlistIds = body.playlistIds ?? [];
  if (!Array.isArray(playlistIds) || playlistIds.length === 0) {
    throw error(400, "playlistIds required");
  }
  const tagIds = Array.isArray(body.tagIds) ? body.tagIds.map((id) => String(id)) : [];
  const customTags = readCustomTagNamesFromJson(body);
  const sort = typeof body.sort === "string" ? body.sort : "playlist";

  const userId = locals.user.id;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        const result = await importConnectedPlaylists(
          userId,
          playlistIds,
          (progress) => {
            send({ type: "progress", ...progress });
          },
          { tagIds, customTags, sort }
        );
        send({
          type: "done",
          syncRunId: result.syncRunId,
          imported: result.imported,
          unavailable: result.unavailable,
          skipped: result.skipped,
          failed: result.failed,
          errorMessage: result.errorMessage ?? null,
          failures: result.failures ?? [],
          playlists: result.playlists,
        });
      } catch (err) {
        console.error("[zap youtube import]", err);
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Import failed",
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
