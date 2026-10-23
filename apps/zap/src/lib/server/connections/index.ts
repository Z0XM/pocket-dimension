import { describeDiscordCapability } from "$lib/server/discord";
import { getYoutubeLinkStatus, isGoogleOAuthConfigured } from "$lib/server/youtube";
import { countActiveDiscordSinksForUser } from "./discord";

export { logConnectionActivity, listConnectionActivity } from "./activity";
export { getDiscordConnectionPage } from "./discord";
export {
  previewPlaylistImport,
  enrichPlaylistsWithStatus,
  upsertPlaylistPref,
  loadPlaylistPrefs,
  type PlaylistImportStatus,
  type PlaylistPreview,
  type EnrichedPlaylist,
} from "./youtube-status";
export { runYouTubeAutoSyncForUser, YOUTUBE_AUTOSYNC_COOLDOWN_MS } from "./youtube-autosync";

export async function listConnectionsSummary(userId: string) {
  const [discordCap, yt, discordLive] = await Promise.all([
    describeDiscordCapability(),
    getYoutubeLinkStatus(userId),
    countActiveDiscordSinksForUser(userId).catch(() => 0),
  ]);

  return {
    connections: [
      {
        id: "discord" as const,
        name: "Discord",
        href: "/connections/discord",
        configured: discordCap.configured,
        connected: discordLive > 0,
        detail: !discordCap.configured
          ? "Bot not configured"
          : discordLive > 0
            ? `Active in ${discordLive} session${discordLive === 1 ? "" : "s"}`
            : "Ready — attach from a session",
      },
      {
        id: "spotify" as const,
        name: "Spotify",
        href: "/connections/spotify",
        configured: false,
        connected: false,
        detail: "Not available yet",
      },
      {
        id: "youtube" as const,
        name: "YouTube",
        href: "/connections/youtube",
        configured: isGoogleOAuthConfigured(),
        connected: yt.linked,
        detail: !isGoogleOAuthConfigured()
          ? "OAuth not configured"
          : yt.linked
            ? `Connected · ${new Date(yt.linkedAt).toLocaleDateString()}`
            : "Not connected",
      },
    ],
  };
}
