import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { readCustomTagNamesFromJson } from "$lib/custom-tags";
import { createImportJob, scheduleImportJob } from "$lib/server/import-jobs";
import { resolveYtDlpBin } from "$lib/server/ingest";
import { isStorageConfigured } from "$lib/server/storage";

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");
  if (!isStorageConfigured()) throw error(503, "Object storage is not configured");
  if (!(await resolveYtDlpBin())) throw error(503, "yt-dlp is not installed");

  const body = (await request.json().catch(() => ({}))) as {
    url?: string;
    tagIds?: unknown;
    customTag?: unknown;
    customTags?: unknown;
  };
  const url = String(body.url ?? "").trim();
  if (!url) throw error(400, "Paste a public song or playlist URL.");
  const selectedTagIds = Array.isArray(body.tagIds) ? body.tagIds.map((id) => String(id).trim()).filter(Boolean) : [];
  const customTagNames = readCustomTagNamesFromJson(body);

  const label = url.length > 80 ? `${url.slice(0, 77)}…` : url;
  const job = await createImportJob({
    userId: locals.user.id,
    kind: "url",
    label: `URL · ${label}`,
    source: { url, tagIds: selectedTagIds, customTags: customTagNames },
  });
  scheduleImportJob(job.id);

  return json({ jobId: job.id, status: job.status, label: job.label }, { status: 202 });
};
