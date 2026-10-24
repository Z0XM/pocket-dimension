import type { SongProgress } from "$lib/server/ingest/progress";

/** In-process live per-song progress for running import jobs (polled by `/api/jobs`). */
const byJob = new Map<string, SongProgress[]>();

export function setJobLiveSongs(jobId: string, songs: SongProgress[]) {
  byJob.set(jobId, songs.map((s) => ({ ...s })));
}

export function getJobLiveSongs(jobId: string): SongProgress[] {
  return byJob.get(jobId) ?? [];
}

export function clearJobLiveSongs(jobId: string) {
  byJob.delete(jobId);
}
