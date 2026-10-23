import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { readCustomTagNamesFromJson } from "$lib/custom-tags";
import { createImportJob, scheduleImportJob } from "$lib/server/import-jobs";
import { getYoutubeLinkStatus } from "$lib/server/youtube";
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
    skipExisting?: boolean;
  };
  const playlistIds = [...new Set((body.playlistIds ?? []).map((id) => String(id).trim()).filter(Boolean))];
  if (playlistIds.length === 0) throw error(400, "playlistIds required");

  const tagIds = Array.isArray(body.tagIds) ? body.tagIds.map((id) => String(id)) : [];
  const customTags = readCustomTagNamesFromJson(body);
  const sort = typeof body.sort === "string" ? body.sort : "playlist";
  const skipExisting = Boolean(body.skipExisting);

  const label =
    playlistIds.length === 1 ? `YouTube playlist · ${playlistIds[0]}` : `YouTube · ${playlistIds.length} playlists`;

  const job = await createImportJob({
    userId: locals.user.id,
    kind: "youtube_playlist",
    label,
    source: { playlistIds, tagIds, customTags, sort, skipExisting },
  });
  scheduleImportJob(job.id);

  return json({ jobId: job.id, status: job.status, label: job.label }, { status: 202 });
};
