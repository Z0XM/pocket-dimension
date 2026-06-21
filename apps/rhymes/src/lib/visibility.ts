import type { ContentVisibility, Rhyme } from "./rhymes";

/** Public readers may only see published pieces with public visibility. */
export function isPubliclyVisible(visibility: ContentVisibility): boolean {
  return visibility === "public";
}

export function filterPublicRhymes(rhymes: Rhyme[]): Rhyme[] {
  return rhymes.filter((rhyme) => isPubliclyVisible(rhyme.visibility));
}
