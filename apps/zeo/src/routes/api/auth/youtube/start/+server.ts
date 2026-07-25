import { randomBytes } from "node:crypto";
import { redirect } from "@sveltejs/kit";
import { requireUser } from "$lib/server/authz";
import { buildYouTubeOAuthUrl } from "$lib/server/listening/youtube-oauth";
import type { RequestHandler } from "./$types";

const STATE_COOKIE = "zeo_youtube_oauth_state";

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export const GET: RequestHandler = async ({ locals, url, cookies }) => {
  requireUser(locals);

  const state = randomBytes(24).toString("base64url");
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  cookies.set(STATE_COOKIE, JSON.stringify({ state, returnTo }), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    maxAge: 10 * 60,
  });

  throw redirect(302, buildYouTubeOAuthUrl({ requestUrl: url, state }).toString());
};
