import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getYoutubeLinkStatus, isGoogleOAuthConfigured, revokeYoutubeLink } from "$lib/server/youtube";

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");
  const status = await getYoutubeLinkStatus(locals.user.id);
  return json({ ...status, oauthConfigured: isGoogleOAuthConfigured() });
};

export const DELETE: RequestHandler = async ({ locals }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");
  await revokeYoutubeLink(locals.user.id);
  return json({ linked: false, oauthConfigured: isGoogleOAuthConfigured() });
};
