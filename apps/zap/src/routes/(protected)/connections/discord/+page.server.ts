import type { PageServerLoad } from "./$types";
import { getDiscordConnectionPage } from "$lib/server/connections";

export const load: PageServerLoad = async ({ locals }) => {
  return getDiscordConnectionPage(locals.user!.id);
};
