import { error } from "@sveltejs/kit";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export const YOUTUBE_OAUTH_SCOPES = ["https://www.googleapis.com/auth/youtube.readonly", "openid", "email", "profile"];

export const OAUTH_STATE_COOKIE = "zap_youtube_oauth_state";

export type YouTubeTokenResponse = {
  accessToken: string;
  refreshToken: string | null;
  accessExpiresAt: Date;
  scopes: string[];
  googleSub: string;
};

export function isGoogleOAuthConfigured() {
  return Boolean(Bun.env.GOOGLE_CLIENT_ID?.trim() && Bun.env.GOOGLE_CLIENT_SECRET?.trim());
}

function googleOAuthConfig() {
  const clientId = Bun.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = Bun.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw error(503, "Google OAuth is not configured (set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)");
  }
  return { clientId, clientSecret };
}

export function zapOrigin(requestUrl: URL) {
  const configured = Bun.env.ORIGIN?.trim() || Bun.env.PUBLIC_ZAP_ORIGIN?.trim() || Bun.env.PUBLIC_APP_URL?.trim();
  return (configured || requestUrl.origin).replace(/\/$/, "");
}

export function youtubeRedirectUri(requestUrl: URL) {
  return `${zapOrigin(requestUrl)}/api/auth/youtube/callback`;
}

export function buildYouTubeOAuthUrl(options: { requestUrl: URL; state: string }) {
  const { clientId } = googleOAuthConfig();
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", youtubeRedirectUri(options.requestUrl));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", YOUTUBE_OAUTH_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", options.state);
  return url;
}

type GoogleTokenBody = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error_description?: string;
  error?: string;
};

function tokenFromGoogleBody(body: GoogleTokenBody) {
  if (!body.access_token) return null;
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    accessExpiresAt: new Date(Date.now() + Math.max(0, body.expires_in ?? 3600) * 1000),
    scopes: body.scope?.split(/\s+/).filter(Boolean) ?? YOUTUBE_OAUTH_SCOPES,
  };
}

async function parseTokenResponse(response: Response) {
  const body = (await response.json().catch(() => ({}))) as GoogleTokenBody;
  if (!response.ok || !body.access_token) {
    throw error(502, body.error_description ?? body.error ?? "Google token exchange failed");
  }
  return tokenFromGoogleBody(body)!;
}

export async function tryRefreshYouTubeAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = googleOAuthConfig();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const body = (await response.json().catch(() => ({}))) as GoogleTokenBody;
  if (!response.ok) return null;
  return tokenFromGoogleBody(body);
}

async function googleSubForAccessToken(accessToken: string) {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json().catch(() => ({}))) as { sub?: string; error_description?: string; error?: string };
  if (!response.ok || !body.sub) {
    throw error(502, body.error_description ?? body.error ?? "Google user info lookup failed");
  }
  return body.sub;
}

export async function exchangeYouTubeCode(options: { code: string; requestUrl: URL }): Promise<YouTubeTokenResponse> {
  const { clientId, clientSecret } = googleOAuthConfig();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: options.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: youtubeRedirectUri(options.requestUrl),
      grant_type: "authorization_code",
    }),
  });
  const token = await parseTokenResponse(response);
  const googleSub = await googleSubForAccessToken(token.accessToken);
  return { ...token, googleSub };
}
