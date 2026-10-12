/**
 * Phase 4 smoke (no GUI): crypto + oauth URL helpers + unauth API gates.
 * Live Google connect requires GOOGLE_CLIENT_* credentials.
 */
import { encryptToken, decryptToken } from "../src/lib/server/youtube/tokens";
import { buildYouTubeOAuthUrl, isGoogleOAuthConfigured } from "../src/lib/server/youtube/oauth";

const BASE = process.env.ZAP_URL ?? "http://localhost:3013";

Bun.env.BETTER_AUTH_SECRET = Bun.env.BETTER_AUTH_SECRET || "local-dev-better-auth-secret-zap-phase1";
const enc = encryptToken("smoke-token");
console.log("crypto", decryptToken(enc) === "smoke-token" ? "OK" : "FAIL");

console.log("oauthConfigured", isGoogleOAuthConfigured());

if (isGoogleOAuthConfigured()) {
  const url = buildYouTubeOAuthUrl({ requestUrl: new URL(`${BASE}/`), state: "smoke" });
  console.log("authUrlHost", url.hostname);
}

const unauth = await fetch(`${BASE}/api/me/youtube-link`);
console.log("unauth link status", unauth.status, unauth.status === 401 || unauth.status === 403 ? "OK" : "unexpected");

const unauthStart = await fetch(`${BASE}/api/auth/youtube/start`, { redirect: "manual" });
console.log(
  "unauth start",
  unauthStart.status,
  unauthStart.status === 401 || unauthStart.status === 403 || unauthStart.status === 503 ? "OK" : "unexpected"
);

console.log("youtube-oauth-smoke done");
