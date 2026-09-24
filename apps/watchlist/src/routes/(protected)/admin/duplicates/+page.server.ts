import { redirect } from "@sveltejs/kit";
import { listDuplicateSuggestions } from "$lib/duplicates/service";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
  if (!locals.user) {
    throw redirect(307, "/login");
  }
  if (locals.user.role !== "admin") {
    throw redirect(307, "/");
  }

  const tier = (url.searchParams.get("tier") || "all") as "all" | "direct" | "indirect" | "fuzzy";
  const includeDismissed = url.searchParams.get("includeDismissed") === "1";

  const clusters = await listDuplicateSuggestions({ tier, includeDismissed });

  return {
    user: {
      id: locals.user.id,
      username: locals.user.username,
      role: locals.user.role,
    },
    tier,
    includeDismissed,
    clusters,
    counts: {
      total: clusters.length,
      direct: clusters.filter((c) => c.tier === "direct").length,
      indirect: clusters.filter((c) => c.tier === "indirect").length,
      fuzzy: clusters.filter((c) => c.tier === "fuzzy").length,
    },
  };
};
