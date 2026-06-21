import { error } from "@sveltejs/kit";
import { findReadableRhymeBySlug, loadPublicCatalog } from "$lib/server/catalog";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, locals }) => {
  const selectedRhyme = await findReadableRhymeBySlug(params.slug, {
    includeHiddenForUserId: locals.user?.id,
  });

  if (!selectedRhyme) {
    throw error(404, "Rhyme not found");
  }

  return {
    rhymes: await loadPublicCatalog(),
    initialSlug: selectedRhyme.slug,
    title: selectedRhyme.frontmatter.title ?? "rhymes",
    description: selectedRhyme.summary || "Browse and read rhymes inline.",
  };
};
