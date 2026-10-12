/**
 * Phase 3 smoke (no GUI):
 * 1) unit-level parse + duration helpers (via bun test)
 * 2) yt-dlp binary present
 * 3) optional live probe of a short known URL when NETWORK_INGEST=1
 * 4) API rejects unauthenticated / missing url
 *
 * Full R2 download requires S3_* + cookies for many YT videos — skipped unless configured.
 */
import { isOverDurationCap, MAX_TRACK_DURATION_MS } from "../src/lib/server/ingest/limits";
import { parseMediaUrl } from "../src/lib/server/ingest/url-parse";
import { resolveYtDlpBin, probeUrl } from "../src/lib/server/ingest/ytdlp";

const BASE = process.env.ZAP_URL ?? "http://localhost:3013";

console.log("duration gate", isOverDurationCap(MAX_TRACK_DURATION_MS + 1000) === true ? "OK" : "FAIL");
const parsed = parseMediaUrl("https://youtu.be/dQw4w9WgXcQ");
console.log("parse video", parsed?.kind === "youtube_video" ? "OK" : "FAIL", parsed);

const bin = await resolveYtDlpBin();
console.log("yt-dlp", bin ?? "MISSING");

const unauth = await fetch(`${BASE}/api/ingest/url`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: "https://youtu.be/dQw4w9WgXcQ" }),
});
console.log("unauth ingest", unauth.status, unauth.status === 401 || unauth.status === 403 ? "OK" : "unexpected");

if (process.env.NETWORK_INGEST === "1" && bin) {
  const sample = process.env.INGEST_PROBE_URL ?? "https://www.youtube.com/watch?v=jNQXAC9IVRw"; // me at the zoo (~19s)
  try {
    const probe = await probeUrl(sample);
    console.log("probe", probe.title, probe.durationMs, isOverDurationCap(probe.durationMs) ? "OVER_CAP" : "within_cap");
  } catch (err) {
    console.warn("probe failed (cookies/network?)", err instanceof Error ? err.message : err);
  }
} else {
  console.log("skip live probe (set NETWORK_INGEST=1 to enable)");
}

console.log("ingest-smoke done");
