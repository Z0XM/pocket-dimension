import { randomBytes } from "node:crypto";
import { error, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { buildYouTubeOAuthUrl, isGoogleOAuthConfigured, OAUTH_STATE_COOKIE } from "$lib/server/youtube";

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/library?tab=upload";
  return value;
}

export const GET: RequestHandler = async ({ locals, url, cookies }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");
  if (!isGoogleOAuthConfigured()) {
    throw error(503, "Google OAuth is not configured");
  }

  const state = randomBytes(24).toString("base64url");
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  cookies.set(OAUTH_STATE_COOKIE, JSON.stringify({ state, returnTo }), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    maxAge: 10 * 60,
  });

  throw redirect(302, buildYouTubeOAuthUrl({ requestUrl: url, state }).toString());
};
