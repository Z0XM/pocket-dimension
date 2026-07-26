import { db, schema } from "@pocket-dimension/db";
import { error, redirect } from "@sveltejs/kit";
import { requireUser } from "$lib/server/authz";
import { encryptToken } from "$lib/server/listening/tokens";
import { exchangeYouTubeCode } from "$lib/server/listening/youtube-oauth";
import type { RequestHandler } from "./$types";

const STATE_COOKIE = "zeo_youtube_oauth_state";

type StoredState = {
  state: string;
  returnTo: string;
  popup?: boolean;
};

function readStoredState(value: string | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value) as StoredState;
  } catch {
    return null;
  }
}

export const GET: RequestHandler = async ({ locals, url, cookies }) => {
  const user = requireUser(locals);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = readStoredState(cookies.get(STATE_COOKIE));
  cookies.delete(STATE_COOKIE, { path: "/" });

  if (!code || !state || !storedState || storedState.state !== state) {
    throw error(400, "Invalid YouTube OAuth callback");
  }

  const tokens = await exchangeYouTubeCode({ code, requestUrl: url });
  if (!tokens.refreshToken) {
    throw error(400, "Google did not return a refresh token; disconnect and try linking again");
  }

  await db
    .insert(schema.youtubeAccountLinks)
    .values({
      userId: user.id,
      googleSub: tokens.googleSub,
      refreshTokenEnc: encryptToken(tokens.refreshToken),
      accessTokenEnc: encryptToken(tokens.accessToken),
      accessExpiresAt: tokens.accessExpiresAt,
      scopes: tokens.scopes,
      linkedAt: new Date(),
      revokedAt: null,
    })
    .onConflictDoUpdate({
      target: schema.youtubeAccountLinks.userId,
      set: {
        googleSub: tokens.googleSub,
        refreshTokenEnc: encryptToken(tokens.refreshToken),
        accessTokenEnc: encryptToken(tokens.accessToken),
        accessExpiresAt: tokens.accessExpiresAt,
        scopes: tokens.scopes,
        linkedAt: new Date(),
        revokedAt: null,
      },
    });

  if (storedState.popup) {
    throw redirect(302, "/auth/youtube/popup-done");
  }

  throw redirect(302, storedState.returnTo || "/");
};
