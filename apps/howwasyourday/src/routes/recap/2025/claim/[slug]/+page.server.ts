import { error, redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { canAccessProfile, getProfileBySlug } from "$lib/server/legacy-recap/access";
import { censorEmail } from "$lib/server/legacy-recap/censor";

export const load: PageServerLoad = async ({ params, cookies, locals }) => {
  const slug = params.slug;
  const profile = await getProfileBySlug(slug);
  if (!profile) {
    throw error(404, "Recap not found");
  }

  const already = await canAccessProfile({
    slug: profile.slug,
    profileId: profile.id,
    cookies,
    userId: locals.user?.id,
  });

  if (already) {
    throw redirect(307, `/recap/2025/${profile.slug}`);
  }

  return {
    slug: profile.slug,
    displayName: profile.displayName,
    accentColor: profile.accentColor,
    emailMask: censorEmail(profile.email),
    signedIn: !!locals.user,
  };
};
