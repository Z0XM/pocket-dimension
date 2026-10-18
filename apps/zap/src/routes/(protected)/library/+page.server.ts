import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

/** Legacy Library hub → new routes. */
export const load: PageServerLoad = async ({ url }) => {
  const tab = url.searchParams.get("tab");
  const qs = new URLSearchParams(url.searchParams);
  qs.delete("tab");
  const rest = qs.toString();
  const suffix = rest ? `?${rest}` : "";

  if (tab === "upload") {
    qs.set("add", "url");
    throw redirect(308, `/catalogue?${qs}`);
  }
  if (tab === "playlists") throw redirect(308, `/playlists${suffix}`);
  if (tab === "history") throw redirect(308, `/history${suffix}`);
  throw redirect(308, `/catalogue${suffix}`);
};
