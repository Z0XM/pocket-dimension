import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { DiscordSinkError, listDiscordChannels } from "$lib/server/discord";

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");
  try {
    return json(await listDiscordChannels(params.guildId!));
  } catch (err) {
    if (err instanceof DiscordSinkError) throw error(err.status, err.message);
    throw err;
  }
};
