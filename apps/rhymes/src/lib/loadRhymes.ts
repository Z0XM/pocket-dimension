import { parseAllRhymes, parseRhymes, type Rhyme } from "./rhymes";

function loadRawRhymeModules(): Record<string, string> {
  return import.meta.glob("../assets/rhymes/*.md", {
    eager: true,
    query: "?raw",
    import: "default",
  }) as Record<string, string>;
}

/** All parsed pieces, including drafts and hidden published content. */
export function loadAllRhymes(): Rhyme[] {
  return parseAllRhymes(loadRawRhymeModules());
}

/** Public reader catalog: only publicly visible published pieces. */
export function loadPublicRhymes(): Rhyme[] {
  return parseRhymes(loadRawRhymeModules());
}

export function findPublicRhymeBySlug(slug: string): Rhyme | undefined {
  return loadPublicRhymes().find((rhyme) => rhyme.slug === slug);
}

/** @deprecated Use loadPublicRhymes() for public routes. */
export function loadRhymes(): Rhyme[] {
  return loadPublicRhymes();
}
