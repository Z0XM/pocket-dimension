import { env } from "$lib/server/env";

type WorkerPlayJob = {
  sessionId: string;
  roomId: string;
  livekitRoomName: string;
  videoId: string;
  positionMs?: number;
  botIdentity: string;
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
  play(job: WorkerPlayJob) {
    return postWorkerJob("/jobs/play", job);
  },
  pause(sessionId: string) {
    return postWorkerJob("/jobs/pause", { sessionId });
  },
  resume(sessionId: string) {
    return postWorkerJob("/jobs/resume", { sessionId });
  },
  seek(sessionId: string, positionMs: number) {
    return postWorkerJob("/jobs/seek", { sessionId, positionMs });
  },
  skip(sessionId: string) {
    return postWorkerJob("/jobs/skip", { sessionId });
  },
  stop(sessionId: string) {
    return postWorkerJob("/jobs/stop", { sessionId });
  },
};
