import { env } from "$lib/server/env";

type WorkerSessionJob = {
  sessionId: string;
  roomId: string;
  livekitRoomName: string;
  botIdentity: string;
};

type WorkerPlayJob = WorkerSessionJob & {
  videoId: string;
  positionMs?: number;
  generation: number;
};

function workerBaseUrl() {
  const url = env.MUSIC_WORKER_URL?.replace(/\/$/, "");
  if (!url || !env.MUSIC_WORKER_SECRET) {
    console.warn("Shared listening worker is not configured; skipping worker job");
    return null;
  }
  return url;
}

async function postWorkerJob(path: string, body: unknown) {
  const baseUrl = workerBaseUrl();
  if (!baseUrl) return;

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.MUSIC_WORKER_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.warn(`Shared listening worker job ${path} failed: ${response.status}`);
    }
  } catch (cause) {
    console.warn(`Shared listening worker job ${path} failed`, cause);
  }
}

export const listeningWorkerBridge = {
  /** Connect the LiveKit listening bot early and keep it for the session. */
  prepare(job: WorkerSessionJob) {
    return postWorkerJob("/jobs/prepare", job);
  },
  /** Resolve yt-dlp audio URLs into the worker cache (fire-and-forget). */
  prefetch(videoIds: string[]) {
    const ids = [...new Set(videoIds.filter(Boolean))];
    if (ids.length === 0) return;
    return postWorkerJob("/jobs/prefetch", { videoIds: ids });
  },
  /** Prefetch URL + prebuffer PCM for the likely next track. */
  warm(input: { sessionId: string; videoId: string }) {
    return postWorkerJob("/jobs/warm", input);
  },
  play(job: WorkerPlayJob) {
    return postWorkerJob("/jobs/play", job);
  },
  pause(sessionId: string, generation: number) {
    return postWorkerJob("/jobs/pause", { sessionId, generation });
  },
  resume(sessionId: string, generation: number) {
    return postWorkerJob("/jobs/resume", { sessionId, generation });
  },
  seek(sessionId: string, positionMs: number, generation: number) {
    return postWorkerJob("/jobs/seek", { sessionId, positionMs, generation });
  },
  skip(sessionId: string) {
    return postWorkerJob("/jobs/skip", { sessionId });
  },
  /** Stop current playback. Pass teardown to also disconnect the session bot. */
  stop(sessionId: string, options?: { teardown?: boolean }) {
    return postWorkerJob("/jobs/stop", { sessionId, teardown: Boolean(options?.teardown) });
  },
};
