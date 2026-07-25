type PlayJob = {
  sessionId: string;
  roomId: string;
  livekitRoomName: string;
  videoId: string;
  positionMs?: number;
  botIdentity: string;
};

type PlaybackState = PlayJob & {
  stopped: boolean;
  paused: boolean;
  ffmpeg?: Bun.Subprocess;
  room?: { disconnect?: () => Promise<void> | void };
};

const PORT = Number(Bun.env.PORT ?? 3010);
const SECRET = Bun.env.MUSIC_WORKER_SECRET ?? "";
const ZEO_APP_URL = (Bun.env.ZEO_APP_URL ?? Bun.env.PUBLIC_ZEO_URL ?? "http://127.0.0.1:3008").replace(/\/$/, "");
const SAMPLE_RATE = 48_000;
const CHANNELS = 2;
const FRAME_SAMPLES_PER_CHANNEL = 960;
const FRAME_BYTES = FRAME_SAMPLES_PER_CHANNEL * CHANNELS * 2;

const activeJobs = new Map<string, PlaybackState>();
const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<Record<string, any>>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requireAuth(request: Request) {
  if (!SECRET) return false;
  return request.headers.get("authorization") === `Bearer ${SECRET}`;
}

async function readJson<T>(request: Request) {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function isPlayJob(value: unknown): value is PlayJob {
  const body = value as Partial<PlayJob>;
  return Boolean(body?.sessionId && body.roomId && body.livekitRoomName && body.videoId && body.botIdentity);
}

async function postWorkerEvent(sessionId: string, event: "track_ended" | "track_error", errorMessage?: string) {
  if (!SECRET) return;

  await fetch(`${ZEO_APP_URL}/api/internal/listening/worker-event`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sessionId, event, errorMessage }),
  }).catch((cause) => {
    console.warn("Failed to post listening worker event", cause);
  });
}

async function fetchBotToken(job: PlayJob) {
  const response = await fetch(`${ZEO_APP_URL}/api/internal/listening/bot-token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ roomId: job.roomId }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    token?: string;
    livekitUrl?: string;
  };

  if (!response.ok || !body.token || !body.livekitUrl) {
    throw new Error(`Failed to fetch bot token: ${response.status}`);
  }

  return body;
}

async function resolveAudioUrl(videoId: string) {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const proc = Bun.spawn(["yt-dlp", "-f", "bestaudio", "-g", videoUrl], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);

  if (exitCode !== 0) {
    throw new Error(stderr.trim() || "yt-dlp failed");
  }

  const audioUrl = stdout
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  if (!audioUrl) {
    throw new Error("yt-dlp did not return an audio URL");
  }

  return audioUrl;
}

async function connectRtc(job: PlayJob) {
  const rtc = await dynamicImport("@livekit/rtc-node");
  const bot = await fetchBotToken(job);
  const room = new rtc.Room();
  await room.connect(bot.livekitUrl, bot.token);

  const source = new rtc.AudioSource(SAMPLE_RATE, CHANNELS);
  const track =
    typeof rtc.LocalAudioTrack?.createAudioTrack === "function"
      ? rtc.LocalAudioTrack.createAudioTrack("shared-listening", source)
      : new rtc.LocalAudioTrack("shared-listening", source);
  const sourceGrant = rtc.TrackSource?.SOURCE_MICROPHONE ?? rtc.TrackSource?.MICROPHONE ?? "microphone";
  await room.localParticipant.publishTrack(track, { source: sourceGrant });

  return { rtc, room, source };
}

async function pumpFfmpegToLiveKit(state: PlaybackState, audioUrl: string) {
  const { rtc, room, source } = await connectRtc(state);
  state.room = room;

  const seekSeconds = Math.max(0, Math.floor((state.positionMs ?? 0) / 1000));
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    ...(seekSeconds > 0 ? ["-ss", String(seekSeconds)] : []),
    "-i",
    audioUrl,
    "-vn",
    "-f",
    "s16le",
    "-ar",
    String(SAMPLE_RATE),
    "-ac",
    String(CHANNELS),
    "pipe:1",
  ];

  const ffmpeg = Bun.spawn(["ffmpeg", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  state.ffmpeg = ffmpeg;

  const reader = ffmpeg.stdout.getReader();
  let pending = new Uint8Array(0);

  while (!state.stopped) {
    const { value, done } = await reader.read();
    if (done) break;
    pending = concatBytes(pending, value);

    while (pending.byteLength >= FRAME_BYTES && !state.stopped) {
      while (state.paused && !state.stopped) {
        await Bun.sleep(50);
      }

      const frameBytes = pending.slice(0, FRAME_BYTES);
      pending = pending.slice(FRAME_BYTES);
      const samples = new Int16Array(frameBytes.buffer, frameBytes.byteOffset, frameBytes.byteLength / 2);
      const frame = new rtc.AudioFrame(samples, SAMPLE_RATE, CHANNELS, FRAME_SAMPLES_PER_CHANNEL);
      await source.captureFrame(frame);
    }
  }

  const exitCode = await ffmpeg.exited;
  if (!state.stopped && exitCode !== 0) {
    const stderr = await new Response(ffmpeg.stderr).text();
    throw new Error(stderr.trim() || "ffmpeg failed");
  }
}

function concatBytes(left: Uint8Array, right: Uint8Array) {
  const merged = new Uint8Array(left.byteLength + right.byteLength);
  merged.set(left, 0);
  merged.set(right, left.byteLength);
  return merged;
}

async function stopJob(sessionId: string, notify = false) {
  const existing = activeJobs.get(sessionId);
  if (!existing) return;

  existing.stopped = true;
  existing.ffmpeg?.kill();
  await existing.room?.disconnect?.();
  activeJobs.delete(sessionId);

  if (notify) {
    await postWorkerEvent(sessionId, "track_ended");
  }
}

async function startPlay(job: PlayJob) {
  await stopJob(job.sessionId);
  const state: PlaybackState = { ...job, stopped: false, paused: false };
  activeJobs.set(job.sessionId, state);

  try {
    const audioUrl = await resolveAudioUrl(job.videoId);
    await pumpFfmpegToLiveKit(state, audioUrl);
    activeJobs.delete(job.sessionId);
    if (!state.stopped) {
      await postWorkerEvent(job.sessionId, "track_ended");
    }
  } catch (cause) {
    activeJobs.delete(job.sessionId);
    if (!state.stopped) {
      const message = cause instanceof Error ? cause.message : "Playback failed";
      await postWorkerEvent(job.sessionId, "track_error", message);
    }
  } finally {
    await state.room?.disconnect?.();
  }
}

async function handleJob(request: Request, path: string) {
  if (!requireAuth(request)) {
    return json({ error: "unauthorized" }, 401);
  }

  if (path === "/jobs/play") {
    const body = await readJson<PlayJob>(request);
    if (!isPlayJob(body)) return json({ error: "invalid play job" }, 400);
    void startPlay(body);
    return json({ ok: true });
  }

  const body = (await readJson<{ sessionId?: string; positionMs?: number }>(request)) ?? {};
  if (!body.sessionId) return json({ error: "sessionId is required" }, 400);
  const state = activeJobs.get(body.sessionId);

  if (path === "/jobs/pause") {
    if (state) state.paused = true;
    return json({ ok: true });
  }

  if (path === "/jobs/resume") {
    if (state) state.paused = false;
    return json({ ok: true });
  }

  if (path === "/jobs/seek") {
    if (!state) return json({ ok: true });
    const restarted: PlayJob = { ...state, positionMs: Math.max(0, body.positionMs ?? 0) };
    void startPlay(restarted);
    return json({ ok: true });
  }

  if (path === "/jobs/skip") {
    await stopJob(body.sessionId);
    return json({ ok: true });
  }

  if (path === "/jobs/stop") {
    await stopJob(body.sessionId);
    return json({ ok: true });
  }

  return json({ error: "not found" }, 404);
}

Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true });
    }
    if (request.method === "POST" && url.pathname.startsWith("/jobs/")) {
      return handleJob(request, url.pathname);
    }
    return json({ error: "not found" }, 404);
  },
});

console.info(`zeo music worker listening on :${PORT}`);
