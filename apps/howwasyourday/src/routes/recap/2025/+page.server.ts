import type { PageServerLoad } from "./$types";
import { getPublicProfiles } from "$lib/server/legacy-recap/access";

export const load: PageServerLoad = async ({ locals }) => {
  const profiles = await getPublicProfiles();

  return {
    users: profiles.map((p) => ({
      rank: p.rank,
      slug: p.slug,
      display_name: p.displayName,
      accent_color: p.accentColor,
      days_filled: p.daysFilled,
      drawings_count: p.drawingsCount,
      months_filled: p.monthsFilled,
      avg_score: p.avgScore != null ? Number(p.avgScore) : null,
      first_date: p.firstDate,
      last_date: p.lastDate,
    })),
    signedIn: !!locals.user,
  };
};
