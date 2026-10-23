import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getDiscordConnectionPage } from "$lib/server/connections";

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");
  return json(await getDiscordConnectionPage(locals.user.id));
};
