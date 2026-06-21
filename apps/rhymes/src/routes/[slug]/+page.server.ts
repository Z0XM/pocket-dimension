import { error } from "@sveltejs/kit";
import { findPublicRhymeBySlug, loadPublicRhymes } from "$lib/loadRhymes";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params }) => {
  const selectedRhyme = findPublicRhymeBySlug(params.slug);

  if (!selectedRhyme) {
    throw error(404, "Rhyme not found");
  }

  return {
    rhymes: loadPublicRhymes(),
    initialSlug: selectedRhyme.slug,
    title: selectedRhyme.frontmatter.title ?? "rhymes",
    description: selectedRhyme.summary || "Browse and read rhymes inline.",
  };
};
