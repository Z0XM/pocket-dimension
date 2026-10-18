import { db, schema } from "@pocket-dimension/db";
import { error, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { encryptToken, exchangeYouTubeCode, OAUTH_STATE_COOKIE } from "$lib/server/youtube";

type StoredState = { state: string; returnTo: string };

function readStoredState(value: string | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value) as StoredState;
  } catch {
    return null;
  }
}

export const GET: RequestHandler = async ({ locals, url, cookies }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = readStoredState(cookies.get(OAUTH_STATE_COOKIE));
  cookies.delete(OAUTH_STATE_COOKIE, { path: "/" });

  if (!code || !state || !storedState || storedState.state !== state) {
    const googleError = url.searchParams.get("error");
    console.error("[zap youtube oauth] invalid callback", {
      googleError,
      hasCode: Boolean(code),
      hasState: Boolean(state),
      hasStoredState: Boolean(storedState),
      stateMatches: Boolean(storedState && storedState.state === state),
    });
    throw error(400, googleError ? `YouTube linking failed: ${googleError}` : "Invalid YouTube OAuth callback");
  }

  const tokens = await exchangeYouTubeCode({ code, requestUrl: url });
  if (!tokens.refreshToken) {
    throw error(400, "Google did not return a refresh token; disconnect and try linking again");
  }

  await db
    .insert(schema.zapYoutubeAccountLinks)
    .values({
      userId: locals.user.id,
      googleSub: tokens.googleSub,
      refreshTokenEnc: encryptToken(tokens.refreshToken),
      accessTokenEnc: encryptToken(tokens.accessToken),
      accessExpiresAt: tokens.accessExpiresAt,
      scopes: tokens.scopes,
      linkedAt: new Date(),
      revokedAt: null,
    })
    .onConflictDoUpdate({
      target: schema.zapYoutubeAccountLinks.userId,
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

  throw redirect(302, storedState.returnTo || "/catalogue?add=youtube");
};
