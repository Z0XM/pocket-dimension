import type { PageServerLoad } from "./$types";
import { getDiscordConnectionPage } from "$lib/server/connections";
import { loadYouTubeConnectionPage } from "$lib/server/connections/youtube-page";

const TABS = new Set(["discord", "spotify", "youtube"]);

export const load: PageServerLoad = async ({ locals, url }) => {
  const userId = locals.user!.id;
  const raw = url.searchParams.get("tab")?.trim().toLowerCase() ?? "discord";
  const tab = TABS.has(raw) ? (raw as "discord" | "spotify" | "youtube") : "discord";

  const [discord, youtube] = await Promise.all([getDiscordConnectionPage(userId), loadYouTubeConnectionPage(userId)]);

  return { tab, discord, youtube };
};
