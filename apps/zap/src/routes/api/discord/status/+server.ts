import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { describeDiscordCapability } from "$lib/server/discord";

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) throw error(401, "Sign in required");
  return json(await describeDiscordCapability());
};
