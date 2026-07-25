import { error } from "@sveltejs/kit";
import { env } from "$lib/server/env";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export const YOUTUBE_OAUTH_SCOPES = ["https://www.googleapis.com/auth/youtube.readonly", "openid", "email", "profile"];

export type YouTubeTokenResponse = {
  accessToken: string;
  refreshToken: string | null;
  accessExpiresAt: Date;
  scopes: string[];
  googleSub: string;
};

function googleOAuthConfig() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw error(503, "Google OAuth is not configured");
  }

  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  };
}

export function zeoOrigin(requestUrl: URL) {
  const configured = env.PUBLIC_ZEO_ORIGIN ?? env.PUBLIC_ZEO_URL ?? env.PUBLIC_APP_URL;
  return (configured ?? requestUrl.origin).replace(/\/$/, "");
}

export function youtubeRedirectUri(requestUrl: URL) {
  return `${zeoOrigin(requestUrl)}/api/auth/youtube/callback`;
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

async function parseTokenResponse(response: Response) {
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error_description?: string;
    error?: string;
  };

  if (!response.ok || !body.access_token) {
    throw error(502, body.error_description ?? body.error ?? "Google token exchange failed");
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    accessExpiresAt: new Date(Date.now() + Math.max(0, body.expires_in ?? 3600) * 1000),
    scopes: body.scope?.split(/\s+/).filter(Boolean) ?? YOUTUBE_OAUTH_SCOPES,
  };
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

export async function refreshYouTubeAccessToken(refreshToken: string) {
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

  return parseTokenResponse(response);
}
