import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DURATION_CAP_MESSAGE, isOverDurationCap } from "./limits";

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
  const args: string[] = ["--no-playlist", "--no-warnings", "-q"];
  const deno = await resolveDenoBin();
  if (deno) args.push("--js-runtimes", `deno:${deno}`);
  else args.push("--js-runtimes", "bun");

  const cookies = await resolveCookiesPath();
  if (cookies) args.push("--cookies", cookies);
  return args;
}

async function runYtDlp(extra: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const bin = await resolveYtDlpBin();
  if (!bin) throw new Error("yt-dlp is not installed (deploy Zap with the fat Dockerfile)");

  const args = [...(await baseArgs()), ...extra];
  // playlist listing should allow playlists
  const cleaned = args.includes("--flat-playlist") ? args.filter((a) => a !== "--no-playlist") : args;

  const proc = Bun.spawn([bin, ...cleaned], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, PATH: `${process.env.HOME ?? ""}/bin:${process.env.PATH ?? ""}` },
  });
  const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  return { code, stdout, stderr };
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
  const { code, stdout, stderr } = await runYtDlp(["-J", url]);
  if (code !== 0) {
    throw new Error(stderr.trim() || stdout.trim() || "yt-dlp probe failed");
  }
  const json = JSON.parse(stdout) as Record<string, unknown>;
  // Playlist JSON has entries
  if (Array.isArray(json.entries) && !json.id) {
    throw new Error("URL is a playlist — expand entries first");
  }
  return probeFromJson(json);
}

export async function listPlaylistEntries(playlistUrl: string): Promise<{ id: string; title: string; url: string; durationMs: number | null }[]> {
  const { code, stdout, stderr } = await runYtDlp(["--flat-playlist", "-J", playlistUrl]);
  if (code !== 0) {
    throw new Error(stderr.trim() || "yt-dlp playlist probe failed");
  }
  const json = JSON.parse(stdout) as { entries?: Record<string, unknown>[] };
  const entries = json.entries ?? [];
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

export async function downloadBestAudio(url: string): Promise<YtDlpDownload & { workDir: string }> {
  const probe = await probeUrl(url);
  if (isOverDurationCap(probe.durationMs)) {
    throw new Error(DURATION_CAP_MESSAGE);
  }

  const workDir = await mkdtemp(join(tmpdir(), "zap-ingest-"));
  const outTemplate = join(workDir, "audio.%(ext)s");

  // Prefer source bestaudio (no forced re-encode). Fallback: extract to m4a via ffmpeg.
  let { code, stderr } = await runYtDlp(["-f", "bestaudio/best", "-o", outTemplate, url]);
  if (code !== 0) {
    ({ code, stderr } = await runYtDlp(["-f", "bestaudio/best", "-x", "--audio-format", "m4a", "--audio-quality", "0", "-o", outTemplate, url]));
  }

  if (code !== 0) {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
    throw new Error(stderr.trim() || "yt-dlp download failed");
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
