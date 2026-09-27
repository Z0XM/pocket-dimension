import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { canAccessProfile, getProfileBySlug } from "$lib/server/legacy-recap/access";
import type { UserRecap } from "$lib/legacy-recap";

export const load: PageServerLoad = async ({ params, cookies, locals }) => {
  const slug = params.slug;
  const profile = await getProfileBySlug(slug);
  if (!profile) {
    return redirect(307, "/recap/2025");
  }

  const allowed = await canAccessProfile({
    slug: profile.slug,
    profileId: profile.id,
    cookies,
    userId: locals.user?.id,
  });

  if (!allowed) {
    return redirect(307, `/recap/2025/claim/${profile.slug}`);
  }

  return {
    recap: profile.payload as UserRecap,
    slug: profile.slug,
  };
};
