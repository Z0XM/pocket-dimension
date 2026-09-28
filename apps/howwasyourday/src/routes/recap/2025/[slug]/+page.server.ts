import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { canAccessProfile, getAiAnalysisForProfile, getProfileBySlug } from "$lib/server/legacy-recap/access";
import type { AiAnalysisBody } from "$lib/legacy-recap/ai-analysis-types";
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

  const aiRow = await getAiAnalysisForProfile(profile.id);
  const aiAnalysis = aiRow?.analysis && typeof aiRow.analysis === "object" ? (aiRow.analysis as AiAnalysisBody) : null;

  return {
    recap: profile.payload as UserRecap,
    slug: profile.slug,
    aiAnalysis,
  };
};
