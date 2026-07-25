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
const HOST = Bun.env.HOST ?? "0.0.0.0";
const SECRET = Bun.env.MUSIC_WORKER_SECRET ?? "";
const ZEO_APP_URL = (Bun.env.ZEO_APP_URL ?? Bun.env.PUBLIC_ZEO_URL ?? "http://127.0.0.1:3008").replace(/\/$/, "");
const SAMPLE_RATE = 48_000;
const CHANNELS = 2;
const FRAME_SAMPLES_PER_CHANNEL = 960;
const FRAME_BYTES = FRAME_SAMPLES_PER_CHANNEL * CHANNELS * 2;

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

  const inline = Bun.env.YTDLP_COOKIES?.trim();
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
      if (audioUrl) return audioUrl;
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
  if (!FFMPEG_BIN) throw new Error("ffmpeg not found on PATH");
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

  const ffmpeg = Bun.spawn([FFMPEG_BIN, ...args], {
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
