import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatYtDlpFailure } from "./errors";
import { DURATION_CAP_MESSAGE, isOverDurationCap } from "./limits";
import { createPercentThrottle, parseYtDlpDownloadPercent } from "./progress";

const YOUTUBE_CLIENT_FALLBACK = "youtube:player_client=android,web,tv,web_safari";

export type YtDlpProbe = {
  id: string;
  title: string;
  uploader: string | null;
  durationMs: number | null;
  webpageUrl: string | null;
  extractor: string | null;
};

export type YtDlpDownload = {
  filePath: string;
  contentType: string;
  ext: string;
  bytes: Uint8Array;
  probe: YtDlpProbe;
};

async function resolveBinary(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    try {
      const proc = Bun.spawn([candidate, "--version"], { stdout: "pipe", stderr: "pipe" });
      const code = await proc.exited;
      if (code === 0) return candidate;
    } catch {
      // try next
    }
  }
  return null;
}

let cachedYtDlp: string | null | undefined;
let cachedDeno: string | null | undefined;
let cookiesPathPromise: Promise<string | null> | null = null;

export async function resolveYtDlpBin(): Promise<string | null> {
  if (cachedYtDlp !== undefined) return cachedYtDlp;
  const fromEnv = Bun.env.YT_DLP_BIN?.trim();
  cachedYtDlp = await resolveBinary(
    [...(fromEnv ? [fromEnv] : []), "yt-dlp", "/usr/local/bin/yt-dlp", "/usr/bin/yt-dlp", `${process.env.HOME ?? ""}/bin/yt-dlp`].filter(Boolean)
  );
  return cachedYtDlp;
}

async function resolveDenoBin(): Promise<string | null> {
  if (cachedDeno !== undefined) return cachedDeno;
  cachedDeno = await resolveBinary(["deno", "/usr/local/bin/deno", "/usr/bin/deno"]);
  return cachedDeno;
}

async function resolveCookiesPath(): Promise<string | null> {
  if (cookiesPathPromise) return cookiesPathPromise;
  cookiesPathPromise = (async () => {
    const fromEnv = Bun.env.YTDLP_COOKIES_FILE?.trim();
    if (fromEnv) {
      const file = Bun.file(fromEnv);
      if (await file.exists()) return fromEnv;
      console.warn(`[zap ingest] YTDLP_COOKIES_FILE missing: ${fromEnv}`);
    }

    const b64 = Bun.env.YTDLP_COOKIES_B64?.trim();
    let inline = Bun.env.YTDLP_COOKIES?.trim() ?? "";
    if (b64) {
      try {
        inline = Buffer.from(b64, "base64").toString("utf8").trim();
      } catch {
        inline = "";
      }
    } else if (inline.includes("\\n") && !inline.includes("\n")) {
      inline = inline.replace(/\\n/g, "\n");
    }
    if (!inline) return null;

    const path = "/tmp/zap-ytdlp-cookies.txt";
    await writeFile(path, inline.endsWith("\n") ? inline : `${inline}\n`);
    return path;
  })();
  return cookiesPathPromise;
}

async function baseArgs(): Promise<string[]> {
  // Avoid -q so ERROR lines stay on stderr when YouTube bot-checks
  const args: string[] = ["--no-playlist", "--no-warnings"];
  const deno = await resolveDenoBin();
  if (deno) args.push("--js-runtimes", `deno:${deno}`);
  else args.push("--js-runtimes", "bun");

  const cookies = await resolveCookiesPath();
  if (cookies) args.push("--cookies", cookies);
  return args;
}

async function runYtDlp(
  extra: string[],
  opts?: { onDownloadPercent?: (percent: number) => void }
): Promise<{ code: number; stdout: string; stderr: string }> {
  const bin = await resolveYtDlpBin();
  if (!bin) throw new Error("yt-dlp is not installed (deploy Zap with the fat Dockerfile)");

  const args = [...(await baseArgs()), ...(opts?.onDownloadPercent ? ["--newline"] : []), ...extra];
  // playlist listing should allow playlists
  const cleaned = args.includes("--flat-playlist") ? args.filter((a) => a !== "--no-playlist") : args;

  const proc = Bun.spawn([bin, ...cleaned], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, PATH: `${process.env.HOME ?? ""}/bin:${process.env.PATH ?? ""}` },
  });

  if (!opts?.onDownloadPercent) {
    const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
    return { code, stdout, stderr };
  }

  const emit = createPercentThrottle(opts.onDownloadPercent);
  const readStderr = async () => {
    const reader = proc.stderr.getReader();
    const decoder = new TextDecoder();
    let stderr = "";
    let pending = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      stderr += chunk;
      pending += chunk;
      const lines = pending.split(/\r?\n/);
      pending = lines.pop() ?? "";
      for (const line of lines) {
        const pct = parseYtDlpDownloadPercent(line);
        if (pct != null) emit(pct);
      }
    }
    if (pending) {
      const pct = parseYtDlpDownloadPercent(pending);
      if (pct != null) emit(pct);
    }
    return stderr;
  };

  const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), readStderr(), proc.exited]);
  emit(100);
  return { code, stdout, stderr };
}

function assertYtDlpJson(code: number, stdout: string, stderr: string, label: string): Record<string, unknown> {
  const trimmed = stdout.trim();
  const looksFailed = code !== 0 || !trimmed || trimmed === "null" || /^ERROR:/im.test(stderr) || /Sign in to confirm you’re not a bot/i.test(stderr);
  if (looksFailed) {
    throw new Error(formatYtDlpFailure(stderr, stdout) || `${label} failed`);
  }
  try {
    const json = JSON.parse(trimmed) as unknown;
    if (!json || typeof json !== "object") {
      throw new Error(formatYtDlpFailure(stderr, stdout) || `${label} returned no metadata`);
    }
    return json as Record<string, unknown>;
  } catch (err) {
    if (err instanceof Error && /YouTube blocked|yt-dlp|bot check/i.test(err.message)) throw err;
    throw new Error(formatYtDlpFailure(stderr, stdout) || `${label} returned invalid JSON`);
  }
}

async function runYtDlpJson(extra: string[], label: string): Promise<Record<string, unknown>> {
  let result = await runYtDlp(extra);
  try {
    return assertYtDlpJson(result.code, result.stdout, result.stderr, label);
  } catch (first) {
    // Retry with alternate YouTube clients (helps some bot checks; cookies still preferred)
    if (!extra.includes("--extractor-args")) {
      result = await runYtDlp(["--extractor-args", YOUTUBE_CLIENT_FALLBACK, ...extra]);
      try {
        return assertYtDlpJson(result.code, result.stdout, result.stderr, label);
      } catch (second) {
        throw second instanceof Error ? second : first;
      }
    }
    throw first;
  }
}

function probeFromJson(raw: Record<string, unknown>): YtDlpProbe {
  const durationSec = typeof raw.duration === "number" ? raw.duration : null;
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? "Untitled"),
    uploader: raw.uploader != null ? String(raw.uploader) : raw.channel != null ? String(raw.channel) : null,
    durationMs: durationSec != null && Number.isFinite(durationSec) ? Math.round(durationSec * 1000) : null,
    webpageUrl: raw.webpage_url != null ? String(raw.webpage_url) : null,
    extractor: raw.extractor != null ? String(raw.extractor) : null,
  };
}

export async function probeUrl(url: string): Promise<YtDlpProbe> {
  const json = await runYtDlpJson(["-J", url], "yt-dlp probe");
  // Playlist JSON has entries
  if (Array.isArray(json.entries) && !json.id) {
    throw new Error("URL is a playlist — expand entries first");
  }
  return probeFromJson(json);
}

export async function listPlaylistEntries(playlistUrl: string): Promise<{ id: string; title: string; url: string; durationMs: number | null }[]> {
  const json = await runYtDlpJson(["--flat-playlist", "-J", playlistUrl], "yt-dlp playlist probe");
  const entries = (json.entries as Record<string, unknown>[] | undefined) ?? [];
  return entries
    .map((e) => {
      const id = String(e.id ?? "");
      if (!id) return null;
      const durationSec = typeof e.duration === "number" ? e.duration : null;
      return {
        id,
        title: String(e.title ?? id),
        url: `https://www.youtube.com/watch?v=${id}`,
        durationMs: durationSec != null ? Math.round(durationSec * 1000) : null,
      };
    })
    .filter(Boolean) as { id: string; title: string; url: string; durationMs: number | null }[];
}

export async function downloadBestAudio(
  url: string,
  opts?: { onDownloadPercent?: (percent: number) => void }
): Promise<YtDlpDownload & { workDir: string }> {
  const probe = await probeUrl(url);
  if (isOverDurationCap(probe.durationMs)) {
    throw new Error(DURATION_CAP_MESSAGE);
  }

  const workDir = await mkdtemp(join(tmpdir(), "zap-ingest-"));
  const outTemplate = join(workDir, "audio.%(ext)s");

  const attempts: string[][] = [
    ["-f", "bestaudio/best", "-o", outTemplate, url],
    ["-f", "bestaudio/best", "-x", "--audio-format", "m4a", "--audio-quality", "0", "-o", outTemplate, url],
    ["--extractor-args", YOUTUBE_CLIENT_FALLBACK, "-f", "bestaudio/best", "-o", outTemplate, url],
  ];

  let lastStderr = "";
  let code = 1;
  for (const extra of attempts) {
    ({ code, stderr: lastStderr } = await runYtDlp(extra, { onDownloadPercent: opts?.onDownloadPercent }));
    if (code === 0) break;
  }

  if (code !== 0) {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
    throw new Error(formatYtDlpFailure(lastStderr) || "yt-dlp download failed");
  }

  const glob = new Bun.Glob("audio.*");
  let filePath: string | null = null;
  for await (const name of glob.scan(workDir)) {
    filePath = join(workDir, name);
    break;
  }
  if (!filePath) {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
    throw new Error("yt-dlp produced no audio file");
  }

  const bytes = new Uint8Array(await readFile(filePath));
  const ext = filePath.split(".").pop() || "m4a";
  const contentType =
    ext === "m4a" || ext === "mp4" || ext === "m4b" ? "audio/mp4" : ext === "webm" ? "audio/webm" : ext === "opus" ? "audio/opus" : "audio/mpeg";

  return { filePath, contentType, ext, bytes, probe, workDir };
}

export async function cleanupWorkDir(workDir: string) {
  await rm(workDir, { recursive: true, force: true }).catch(() => {});
}

/** Test helper — clear binary cache. */
export function resetYtDlpCache() {
  cachedYtDlp = undefined;
  cachedDeno = undefined;
  cookiesPathPromise = null;
}
