type SessionRtcJob = {
  sessionId: string;
  roomId: string;
  livekitRoomName: string;
  botIdentity: string;
};

type PlayJob = SessionRtcJob & {
  videoId: string;
  positionMs?: number;
  generation: number;
};

type RtcSession = {
  rtc: Record<string, any>;
  room: { disconnect?: () => Promise<void> | void; localParticipant?: any };
  source: { captureFrame: (frame: unknown) => Promise<void> };
  track: unknown;
  roomId: string;
  livekitRoomName: string;
  botIdentity: string;
};

type WarmState = {
  sessionId: string;
  videoId: string;
  audioUrl: string;
  frames: Uint8Array[];
  cancelled: boolean;
};

type PipedSubprocess = Bun.Subprocess & {
  stdout: ReadableStream<Uint8Array>;
  stderr: ReadableStream<Uint8Array>;
};

type PlaybackState = PlayJob & {
  stopped: boolean;
  paused: boolean;
  started: boolean;
  positionMs: number;
  audioUrl?: string;
  ffmpeg?: PipedSubprocess;
  rtcSession?: RtcSession;
  pumpToken: number;
};

type WorkerEvent = "track_ended" | "track_error" | "playback_started" | "paused" | "resumed" | "position";

const PORT = Number(Bun.env.PORT ?? 3010);
const HOST = Bun.env.HOST ?? "0.0.0.0";
const SECRET = Bun.env.MUSIC_WORKER_SECRET ?? "";
const ZEO_APP_URL = (Bun.env.ZEO_APP_URL ?? Bun.env.PUBLIC_ZEO_URL ?? "http://127.0.0.1:3008").replace(/\/$/, "");
const SAMPLE_RATE = 48_000;
const CHANNELS = 2;
const FRAME_SAMPLES_PER_CHANNEL = 960;
const FRAME_BYTES = FRAME_SAMPLES_PER_CHANNEL * CHANNELS * 2;
const FRAME_MS = (FRAME_SAMPLES_PER_CHANNEL / SAMPLE_RATE) * 1000;
const POSITION_HEARTBEAT_MS = 2_500;
/** Prefill ~2.5s of PCM for the next track so skip/play can start immediately. */
const WARM_TARGET_FRAMES = Math.ceil(2_500 / FRAME_MS);

/** Dokploy/Railpack sometimes ship a PATH without /usr/bin — prefer absolute paths. */
async function resolveBinary(candidates: string[]) {
  for (const candidate of candidates) {
    for (const flag of ["-version", "--version"] as const) {
      try {
        const proc = Bun.spawn([candidate, flag], { stdout: "pipe", stderr: "pipe" });
        if ((await proc.exited) === 0) return candidate;
      } catch {
        // try next
      }
    }
  }
  return null;
}

const FFMPEG_BIN = await resolveBinary(["ffmpeg", "/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"]);
const YT_DLP_BIN = await resolveBinary(["yt-dlp", "/usr/local/bin/yt-dlp", "/usr/bin/yt-dlp"]);
const DENO_BIN = await resolveBinary(["deno", "/usr/local/bin/deno", "/usr/bin/deno"]);
const ffmpegOk = Boolean(FFMPEG_BIN);
const ytDlpOk = Boolean(YT_DLP_BIN);
const denoOk = Boolean(DENO_BIN);

const COOKIES_PATH = await resolveCookiesPath();

async function resolveCookiesPath() {
  const fromEnv = Bun.env.YTDLP_COOKIES_FILE?.trim();
  if (fromEnv) {
    const file = Bun.file(fromEnv);
    if (await file.exists()) return fromEnv;
    console.warn(`YTDLP_COOKIES_FILE set but missing: ${fromEnv}`);
  }

  // Prefer base64 for Dokploy/UI env vars that cannot store real newlines.
  const b64 = Bun.env.YTDLP_COOKIES_B64?.trim();
  let inline = Bun.env.YTDLP_COOKIES?.trim() ?? "";
  if (b64) {
    try {
      inline = Buffer.from(b64, "base64").toString("utf8").trim();
    } catch (cause) {
      console.warn("YTDLP_COOKIES_B64 decode failed", cause);
      inline = "";
    }
  } else if (inline.includes("\\n") && !inline.includes("\n")) {
    // Some dashboards paste multiline as literal \n sequences.
    inline = inline.replace(/\\n/g, "\n");
  }

  if (!inline) return null;

  const path = "/tmp/ytdlp-cookies.txt";
  await Bun.write(path, inline.endsWith("\n") ? inline : `${inline}\n`);
  return path;
}

function ytDlpBaseArgs() {
  const args: string[] = [];
  if (DENO_BIN) {
    args.push("--js-runtimes", `deno:${DENO_BIN}`);
  } else {
    // Bun is already in this image; yt-dlp supports it through 1.3.14 (deprecated).
    args.push("--js-runtimes", "bun");
  }
  if (COOKIES_PATH) {
    args.push("--cookies", COOKIES_PATH);
  }
  return args;
}

const activeJobs = new Map<string, PlaybackState>();
/** LiveKit bot connections kept for the lifetime of a listening session. */
const sessionRtc = new Map<string, RtcSession>();
const audioUrlCache = new Map<string, string>();
/** In-flight next-track warm buffers, keyed by listening session. */
const warmBySession = new Map<string, WarmState>();
const resolvingUrls = new Map<string, Promise<string>>();
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

function isSessionRtcJob(value: unknown): value is SessionRtcJob {
  const body = value as Partial<SessionRtcJob>;
  return Boolean(body?.sessionId && body.roomId && body.livekitRoomName && body.botIdentity);
}

function isPlayJob(value: unknown): value is PlayJob {
  const body = value as Partial<PlayJob>;
  return Boolean(body?.sessionId && body.roomId && body.livekitRoomName && body.botIdentity && body.videoId && typeof body.generation === "number");
}

async function postWorkerEvent(sessionId: string, event: WorkerEvent, details?: { generation?: number; positionMs?: number; errorMessage?: string }) {
  if (!SECRET) return;

  await fetch(`${ZEO_APP_URL}/api/internal/listening/worker-event`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionId,
      event,
      generation: details?.generation,
      positionMs: details?.positionMs,
      at: new Date().toISOString(),
      errorMessage: details?.errorMessage,
    }),
  }).catch((cause) => {
    console.warn("Failed to post listening worker event", cause);
  });
}

const notifiedMediaReady = new Set<string>();

async function notifyMediaReady(videoId: string) {
  if (!SECRET || !videoId || notifiedMediaReady.has(videoId)) return;
  notifiedMediaReady.add(videoId);

  await fetch(`${ZEO_APP_URL}/api/internal/listening/media-ready`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ videoId }),
  }).catch((cause) => {
    notifiedMediaReady.delete(videoId);
    console.warn("Failed to notify media-ready", cause);
  });
}

async function fetchBotToken(job: Pick<SessionRtcJob, "roomId">) {
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
  const cached = audioUrlCache.get(videoId);
  if (cached) {
    void notifyMediaReady(videoId);
    return cached;
  }

  const inflight = resolvingUrls.get(videoId);
  if (inflight) return inflight;

  const resolvePromise = (async () => {
    if (!YT_DLP_BIN) throw new Error("yt-dlp not found on PATH");
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const base = ytDlpBaseArgs();

    // Prefer default clients; fall back to android/web if YouTube challenges the datacenter IP.
    const attempts: string[][] = [
      [...base, "-f", "bestaudio", "-g", videoUrl],
      [...base, "--extractor-args", "youtube:player_client=android,web", "-f", "bestaudio", "-g", videoUrl],
    ];

    let lastError = "yt-dlp failed";
    for (const args of attempts) {
      const proc = Bun.spawn([YT_DLP_BIN, ...args], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr, exitCode] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);

      if (exitCode === 0) {
        const audioUrl = stdout
          .split("\n")
          .map((line) => line.trim())
          .find(Boolean);
        if (audioUrl) {
          audioUrlCache.set(videoId, audioUrl);
          void notifyMediaReady(videoId);
          return audioUrl;
        }
        lastError = "yt-dlp did not return an audio URL";
        continue;
      }

      lastError = stderr.trim() || "yt-dlp failed";
    }

    if (/sign in to confirm you.re not a bot/i.test(lastError) && !COOKIES_PATH) {
      throw new Error(
        `${lastError}\nHint: set YTDLP_COOKIES_FILE or YTDLP_COOKIES on the music-worker (Netscape cookies.txt). See apps/zeo-music-worker/README.md.`
      );
    }

    throw new Error(lastError);
  })();

  resolvingUrls.set(videoId, resolvePromise);
  try {
    return await resolvePromise;
  } finally {
    resolvingUrls.delete(videoId);
  }
}

function canReuseRtc(job: SessionRtcJob, existing?: RtcSession | null) {
  return Boolean(
    existing && existing.roomId === job.roomId && existing.livekitRoomName === job.livekitRoomName && existing.botIdentity === job.botIdentity
  );
}

async function connectRtc(job: SessionRtcJob): Promise<RtcSession> {
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

  return {
    rtc,
    room,
    source,
    track,
    roomId: job.roomId,
    livekitRoomName: job.livekitRoomName,
    botIdentity: job.botIdentity,
  };
}

async function ensureSessionRtc(job: SessionRtcJob): Promise<RtcSession> {
  const existing = sessionRtc.get(job.sessionId);
  if (canReuseRtc(job, existing)) {
    return existing!;
  }

  if (existing) {
    await existing.room.disconnect?.();
    sessionRtc.delete(job.sessionId);
  }

  const session = await connectRtc(job);
  sessionRtc.set(job.sessionId, session);
  return session;
}

async function disconnectSessionRtc(sessionId: string) {
  const existing = sessionRtc.get(sessionId);
  if (!existing) return;
  sessionRtc.delete(sessionId);
  try {
    await existing.room.disconnect?.();
  } catch {
    // already disconnected
  }
}

async function stopFfmpeg(state: PlaybackState) {
  state.pumpToken += 1;
  const ffmpeg = state.ffmpeg;
  state.ffmpeg = undefined;
  if (!ffmpeg) return;
  try {
    ffmpeg.kill();
  } catch {
    // already exited
  }
  await ffmpeg.exited.catch(() => undefined);
}

async function cancelWarm(sessionId: string) {
  const warm = warmBySession.get(sessionId);
  if (!warm) return;
  warm.cancelled = true;
  warmBySession.delete(sessionId);
}

function takeWarm(sessionId: string, videoId: string): WarmState | null {
  const warm = warmBySession.get(sessionId);
  if (!warm || warm.cancelled || warm.videoId !== videoId || warm.frames.length === 0) return null;
  warmBySession.delete(sessionId);
  return warm;
}

function spawnAudioFfmpeg(audioUrl: string, positionMs = 0): PipedSubprocess {
  if (!FFMPEG_BIN) throw new Error("ffmpeg not found on PATH");
  const seekSeconds = Math.max(0, positionMs / 1000);
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

  const ffmpeg = Bun.spawn([FFMPEG_BIN, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (!ffmpeg.stdout || typeof ffmpeg.stdout === "number" || !ffmpeg.stderr || typeof ffmpeg.stderr === "number") {
    throw new Error("ffmpeg stdout/stderr pipes are unavailable");
  }
  return ffmpeg as PipedSubprocess;
}

async function startWarm(sessionId: string, videoId: string) {
  const existing = warmBySession.get(sessionId);
  if (existing && !existing.cancelled && existing.videoId === videoId) {
    return;
  }

  await cancelWarm(sessionId);

  const warm: WarmState = {
    sessionId,
    videoId,
    audioUrl: "",
    frames: [],
    cancelled: false,
  };
  warmBySession.set(sessionId, warm);

  let ffmpeg: PipedSubprocess | undefined;
  try {
    const audioUrl = await resolveAudioUrl(videoId);
    if (warm.cancelled || warmBySession.get(sessionId) !== warm) return;
    warm.audioUrl = audioUrl;

    ffmpeg = spawnAudioFfmpeg(audioUrl, 0);
    const reader = ffmpeg.stdout.getReader();
    let pending = new Uint8Array(0);

    while (!warm.cancelled && warm.frames.length < WARM_TARGET_FRAMES) {
      const { value, done } = await reader.read();
      if (done) break;
      pending = concatBytes(pending, value);
      while (pending.byteLength >= FRAME_BYTES && warm.frames.length < WARM_TARGET_FRAMES) {
        warm.frames.push(pending.slice(0, FRAME_BYTES));
        pending = pending.slice(FRAME_BYTES);
      }
    }

    try {
      await reader.cancel();
    } catch {
      // ignore
    }
  } catch (cause) {
    if (!warm.cancelled) {
      console.warn(`Warm buffer failed for ${videoId}`, cause);
    }
    if (warmBySession.get(sessionId) === warm && warm.frames.length === 0) {
      warmBySession.delete(sessionId);
    }
  } finally {
    if (ffmpeg) {
      try {
        ffmpeg.kill();
      } catch {
        // already exited
      }
      await ffmpeg.exited.catch(() => undefined);
    }
  }
}

async function capturePcmFrame(
  state: PlaybackState,
  rtc: Record<string, any>,
  source: { captureFrame: (frame: unknown) => Promise<void> },
  frameBytes: Uint8Array,
  pumpToken: number
) {
  while (state.paused && !state.stopped && state.pumpToken === pumpToken) {
    await Bun.sleep(50);
  }
  if (state.stopped || state.pumpToken !== pumpToken) return false;

  const samples = new Int16Array(frameBytes.buffer, frameBytes.byteOffset, frameBytes.byteLength / 2);
  const frame = new rtc.AudioFrame(samples, SAMPLE_RATE, CHANNELS, FRAME_SAMPLES_PER_CHANNEL);
  await source.captureFrame(frame);
  state.positionMs = Math.max(0, Math.round(state.positionMs + FRAME_MS));
  return true;
}

async function pumpFfmpegToLiveKit(state: PlaybackState, audioUrl: string, warm?: WarmState | null) {
  const rtcSession = await ensureSessionRtc(state);
  state.rtcSession = rtcSession;
  const { rtc, source } = rtcSession;
  const pumpToken = state.pumpToken;
  let lastHeartbeatAt = 0;

  // Play prebuffered PCM immediately so the room hears audio while ffmpeg opens.
  if (warm && warm.frames.length > 0 && (state.positionMs ?? 0) === 0) {
    for (const frameBytes of warm.frames) {
      if (state.stopped || state.pumpToken !== pumpToken) return;
      const ok = await capturePcmFrame(state, rtc, source, frameBytes, pumpToken);
      if (!ok) return;

      if (!state.started) {
        state.started = true;
        await postWorkerEvent(state.sessionId, "playback_started", {
          generation: state.generation,
          positionMs: state.positionMs,
        });
        lastHeartbeatAt = Date.now();
      }
    }
  }

  // Continue from the prebuffered position so we don't replay the warm lead-in.
  const ffmpeg = spawnAudioFfmpeg(audioUrl, state.positionMs ?? 0);
  const reader = ffmpeg.stdout.getReader();
  state.ffmpeg = ffmpeg;
  let pending = new Uint8Array(0);

  while (!state.stopped && state.pumpToken === pumpToken) {
    const { value, done } = await reader.read();
    if (done) break;
    pending = concatBytes(pending, value);

    while (pending.byteLength >= FRAME_BYTES && !state.stopped && state.pumpToken === pumpToken) {
      const frameBytes = pending.slice(0, FRAME_BYTES);
      pending = pending.slice(FRAME_BYTES);
      const ok = await capturePcmFrame(state, rtc, source, frameBytes, pumpToken);
      if (!ok) break;

      if (!state.started) {
        state.started = true;
        await postWorkerEvent(state.sessionId, "playback_started", {
          generation: state.generation,
          positionMs: state.positionMs,
        });
        lastHeartbeatAt = Date.now();
      } else if (Date.now() - lastHeartbeatAt >= POSITION_HEARTBEAT_MS) {
        lastHeartbeatAt = Date.now();
        void postWorkerEvent(state.sessionId, "position", {
          generation: state.generation,
          positionMs: state.positionMs,
        });
      }
    }
  }

  const exitCode = await ffmpeg.exited;
  if (state.ffmpeg === ffmpeg) {
    state.ffmpeg = undefined;
  }

  if (!state.stopped && state.pumpToken === pumpToken && exitCode !== 0) {
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

/** Stop current playback/ffmpeg but keep the session's LiveKit bot connected. */
async function stopPlayback(sessionId: string) {
  const existing = activeJobs.get(sessionId);
  if (!existing) return null;

  existing.stopped = true;
  await stopFfmpeg(existing);
  if (existing.rtcSession) {
    sessionRtc.set(sessionId, existing.rtcSession);
  }
  activeJobs.delete(sessionId);
  return { audioUrl: existing.audioUrl, videoId: existing.videoId };
}

async function teardownSession(sessionId: string) {
  await stopPlayback(sessionId);
  await cancelWarm(sessionId);
  await disconnectSessionRtc(sessionId);
}

async function startPlay(job: PlayJob) {
  await stopPlayback(job.sessionId);

  const warm = (job.positionMs ?? 0) > 0 ? null : takeWarm(job.sessionId, job.videoId);
  // Drop any in-progress warm (same or other track) so it can't fight playback for ffmpeg/yt-dlp.
  await cancelWarm(job.sessionId);

  const state: PlaybackState = {
    ...job,
    positionMs: Math.max(0, job.positionMs ?? 0),
    stopped: false,
    paused: false,
    started: false,
    pumpToken: 0,
    rtcSession: sessionRtc.get(job.sessionId),
    audioUrl: warm?.audioUrl,
  };
  activeJobs.set(job.sessionId, state);

  try {
    // Ensure the bot is connected before waiting on yt-dlp when possible.
    void ensureSessionRtc(job).then((rtc) => {
      if (activeJobs.get(job.sessionId) === state) {
        state.rtcSession = rtc;
      }
    });

    const audioUrl = state.audioUrl ?? (await resolveAudioUrl(job.videoId));
    state.audioUrl = audioUrl;
    await ensureSessionRtc(job);
    await pumpFfmpegToLiveKit(state, audioUrl, warm);

    const current = activeJobs.get(job.sessionId);
    if (current === state) {
      activeJobs.delete(job.sessionId);
      if (state.rtcSession) {
        sessionRtc.set(job.sessionId, state.rtcSession);
      }
      if (!state.stopped) {
        await postWorkerEvent(job.sessionId, "track_ended", {
          generation: state.generation,
          positionMs: state.positionMs,
        });
      }
    }
  } catch (cause) {
    const current = activeJobs.get(job.sessionId);
    if (current === state) {
      activeJobs.delete(job.sessionId);
      if (state.rtcSession) {
        sessionRtc.set(job.sessionId, state.rtcSession);
      }
    }
    if (!state.stopped) {
      const message = cause instanceof Error ? cause.message : "Playback failed";
      await postWorkerEvent(job.sessionId, "track_error", {
        generation: state.generation,
        positionMs: state.positionMs,
        errorMessage: message,
      });
    }
  }
}

async function handleJob(request: Request, path: string) {
  if (!requireAuth(request)) {
    return json({ error: "unauthorized" }, 401);
  }

  if (path === "/jobs/prepare") {
    const body = await readJson<SessionRtcJob>(request);
    if (!isSessionRtcJob(body)) return json({ error: "invalid prepare job" }, 400);
    void ensureSessionRtc(body).catch((cause) => {
      console.warn("Failed to prepare listening bot RTC", cause);
    });
    return json({ ok: true });
  }

  if (path === "/jobs/prefetch") {
    const body = (await readJson<{ videoIds?: string[] }>(request)) ?? {};
    const videoIds = [...new Set((body.videoIds ?? []).filter((id) => typeof id === "string" && id.length > 0))];
    for (const videoId of videoIds) {
      void resolveAudioUrl(videoId).catch((cause) => {
        console.warn(`Prefetch failed for ${videoId}`, cause);
      });
    }
    return json({ ok: true, count: videoIds.length });
  }

  if (path === "/jobs/warm") {
    const body = (await readJson<{ sessionId?: string; videoId?: string }>(request)) ?? {};
    if (!body.sessionId || !body.videoId) return json({ error: "sessionId and videoId are required" }, 400);
    void startWarm(body.sessionId, body.videoId);
    return json({ ok: true });
  }

  if (path === "/jobs/play") {
    const body = await readJson<PlayJob>(request);
    if (!isPlayJob(body)) return json({ error: "invalid play job" }, 400);
    void startPlay(body);
    return json({ ok: true });
  }

  const body = (await readJson<{ sessionId?: string; positionMs?: number; generation?: number; teardown?: boolean }>(request)) ?? {};
  if (!body.sessionId) return json({ error: "sessionId is required" }, 400);
  const state = activeJobs.get(body.sessionId);

  if (path === "/jobs/pause") {
    if (state) {
      if (typeof body.generation === "number" && body.generation < state.generation) {
        return json({ ok: true, ignored: "stale_generation" });
      }
      if (typeof body.generation === "number") {
        state.generation = body.generation;
      }
      state.paused = true;
      await postWorkerEvent(state.sessionId, "paused", {
        generation: state.generation,
        positionMs: Math.round(state.positionMs),
      });
    }
    return json({ ok: true });
  }

  if (path === "/jobs/resume") {
    if (state) {
      if (typeof body.generation === "number") {
        state.generation = body.generation;
      }
      state.paused = false;
      // Only ack resume once frames are already flowing; otherwise wait for playback_started.
      if (state.started) {
        await postWorkerEvent(state.sessionId, "resumed", {
          generation: state.generation,
          positionMs: Math.round(state.positionMs),
        });
      }
    }
    return json({ ok: true });
  }

  if (path === "/jobs/seek") {
    if (!state) return json({ ok: true });
    const generation = typeof body.generation === "number" ? body.generation : state.generation;
    const restarted: PlayJob = {
      sessionId: state.sessionId,
      roomId: state.roomId,
      livekitRoomName: state.livekitRoomName,
      videoId: state.videoId,
      botIdentity: state.botIdentity,
      generation,
      positionMs: Math.max(0, body.positionMs ?? 0),
    };
    void startPlay(restarted);
    return json({ ok: true });
  }

  if (path === "/jobs/skip") {
    await stopPlayback(body.sessionId);
    return json({ ok: true });
  }

  if (path === "/jobs/stop") {
    if (body.teardown) {
      await teardownSession(body.sessionId);
    } else {
      await stopPlayback(body.sessionId);
    }
    return json({ ok: true });
  }

  return json({ error: "not found" }, 404);
}

Bun.serve({
  hostname: HOST,
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: ffmpegOk && ytDlpOk,
        ffmpeg: ffmpegOk,
        ytDlp: ytDlpOk,
        deno: denoOk,
        cookies: Boolean(COOKIES_PATH),
        ffmpegBin: FFMPEG_BIN,
        ytDlpBin: YT_DLP_BIN,
        denoBin: DENO_BIN,
        sessions: sessionRtc.size,
        warm: warmBySession.size,
        urlCache: audioUrlCache.size,
      });
    }
    if (request.method === "POST" && url.pathname.startsWith("/jobs/")) {
      return handleJob(request, url.pathname);
    }
    return json({ error: "not found" }, 404);
  },
});

console.info(`zeo music worker listening on ${HOST}:${PORT}`);
console.info(
  `tools: ffmpeg=${ffmpegOk ? FFMPEG_BIN : "MISSING"} yt-dlp=${ytDlpOk ? YT_DLP_BIN : "MISSING"} deno=${denoOk ? DENO_BIN : "MISSING"} cookies=${COOKIES_PATH ?? "none"}`
);
if (!ffmpegOk || !ytDlpOk) {
  console.warn("Playback will fail until ffmpeg and yt-dlp are installed (use apps/zeo-music-worker/Dockerfile in prod).");
}
if (!denoOk) {
  console.warn("Deno missing — yt-dlp will fall back to bun for YouTube EJS (install Deno via Dockerfile).");
}
if (!COOKIES_PATH) {
  console.warn("No YTDLP_COOKIES / YTDLP_COOKIES_FILE — YouTube may return 'Sign in to confirm you’re not a bot' from datacenter IPs.");
}

export {};
