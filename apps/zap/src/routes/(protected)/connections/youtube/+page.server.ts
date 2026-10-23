import type { PageServerLoad } from "./$types";
import { listConnectionActivity } from "$lib/server/connections";
import { getYoutubeLinkStatus, isGoogleOAuthConfigured } from "$lib/server/youtube";
import { listUserLibraryActivityPage } from "$lib/server/activity";

export const load: PageServerLoad = async ({ locals }) => {
  const userId = locals.user!.id;
  const [link, oauthConfigured, connActivity, library] = await Promise.all([
    getYoutubeLinkStatus(userId),
    Promise.resolve(isGoogleOAuthConfigured()),
    listConnectionActivity({ userId, provider: "youtube", limit: 30 }),
    listUserLibraryActivityPage({ userId, limit: 40 }).catch(() => ({ entries: [] as Awaited<ReturnType<typeof listUserLibraryActivityPage>>["entries"] })),
  ]);

  const importActivity = library.entries
    .flatMap((e) => {
      if (e.kind !== "playlist_import") return [];
      return [
        {
          id: e.id,
          kind: e.kind,
          summary: `${e.label} · +${e.imported} imported` + (e.unavailable ? ` · ${e.unavailable} unavailable` : ""),
          at: e.at,
        },
      ];
    })
    .slice(0, 20);

  const seen = new Set<string>();
  const activity = [...connActivity, ...importActivity]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    })
    .slice(0, 40);

  return {
    oauthConfigured,
    linked: link.linked,
    linkedAt: link.linked ? link.linkedAt : null,
    scopes: link.linked ? link.scopes : [],
    activity,
    connectHref: `/api/auth/youtube/start?returnTo=${encodeURIComponent("/connections/youtube")}`,
  };
};
