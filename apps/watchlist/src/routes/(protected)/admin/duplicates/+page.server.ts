import { redirect } from "@sveltejs/kit";
import { summarizeDuplicates } from "$lib/duplicates/service";
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

  // Summary only — never block navigation on full cluster payloads / fuzzy scan.
  const summary = await summarizeDuplicates({ includeDismissed, includeFuzzy: false });

  return {
    user: {
      id: locals.user.id,
      username: locals.user.username,
      role: locals.user.role,
    },
    tier,
    includeDismissed,
    summary,
    pageSize: 10,
  };
};
