/**
 * API smoke: create session → enqueue fixture → play/pause → permissions → end.
 * Requires: PG migrated, zap+auth running, fixture asset, cookies from signed-in verified user.
 *
 * Usage:
 *   COOKIE='better-auth.session_token=...' bun ./scripts/session-smoke.ts
 */
const BASE = process.env.ZAP_URL ?? "http://localhost:3013";
const COOKIE = process.env.COOKIE ?? "";

if (!COOKIE) {
  console.error("Set COOKIE=better-auth.session_token=... (from a verified Zap login)");
  process.exit(1);
}

const headers = {
  Cookie: COOKIE.includes("=") ? COOKIE : `better-auth.session_token=${COOKIE}`,
  "Content-Type": "application/json",
  Accept: "application/json",
  Origin: BASE,
};

async function req(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { res, body };
}

const FIXTURE_ID = process.env.FIXTURE_ASSET_ID ?? "01a12c6e-7512-7bc3-bc56-cffa414b5a56";

const created = await req("/api/sessions", { method: "POST", body: "{}" });
if (!created.res.ok) {
  console.error("create failed", created.res.status, created.body);
  process.exit(1);
}
const sessionId = (created.body as { session: { id: string; joinCode: string } }).session.id;
const joinCode = (created.body as { session: { joinCode: string } }).session.joinCode;
console.log("created", sessionId, joinCode);

const queued = await req(`/api/sessions/${sessionId}/queue`, {
  method: "POST",
  body: JSON.stringify({ mediaAssetId: FIXTURE_ID }),
});
if (!queued.res.ok) {
  console.error("enqueue failed", queued.res.status, queued.body);
  process.exit(1);
}
console.log("enqueued", (queued.body as { currentItem: { title: string } | null }).currentItem?.title);

const paused = await req(`/api/sessions/${sessionId}/transport`, {
  method: "POST",
  body: JSON.stringify({ action: "pause" }),
});
if (!paused.res.ok) {
  console.error("pause failed", paused.res.status, paused.body);
  process.exit(1);
}
console.log("paused", (paused.body as { session: { playbackState: string } }).session.playbackState);

const played = await req(`/api/sessions/${sessionId}/transport`, {
  method: "POST",
  body: JSON.stringify({ action: "play" }),
});
if (!played.res.ok) {
  console.error("play failed", played.res.status, played.body);
  process.exit(1);
}
console.log("playing", (played.body as { session: { playbackState: string } }).session.playbackState);

const perms = await req(`/api/sessions/${sessionId}`, {
  method: "PATCH",
  body: JSON.stringify({ guestsCanAdd: true, guestsCanControl: true }),
});
if (!perms.res.ok) {
  console.error("perms failed", perms.res.status, perms.body);
  process.exit(1);
}
console.log(
  "perms",
  (perms.body as { session: { guestsCanAdd: boolean; guestsCanControl: boolean } }).session.guestsCanAdd,
  (perms.body as { session: { guestsCanControl: boolean } }).session.guestsCanControl
);

const ended = await req(`/api/sessions/${sessionId}`, { method: "DELETE" });
if (!ended.res.ok) {
  console.error("end failed", ended.res.status, ended.body);
  process.exit(1);
}
console.log("ended", (ended.body as { session: { status: string } }).session?.status ?? "ok");
console.log("session-smoke OK");
