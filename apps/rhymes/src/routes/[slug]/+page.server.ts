import { error } from "@sveltejs/kit";
import { loadRhymes } from "$lib/loadRhymes";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params }) => {
  const rhymes = loadRhymes();
  const selectedRhyme = rhymes.find((rhyme) => rhyme.slug === params.slug);

  if (!selectedRhyme) {
    throw error(404, "Rhyme not found");
  }

  return {
    rhymes,
    initialSlug: selectedRhyme.slug,
    title: selectedRhyme.frontmatter.title ?? "rhymes",
    description: selectedRhyme.summary || "Browse and read rhymes inline.",
  };
};
