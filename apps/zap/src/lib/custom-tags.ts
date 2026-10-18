export const MAX_CUSTOM_TAGS_PER_ADD = 20;
export const MAX_CUSTOM_TAG_LENGTH = 64;

export function slugifyTag(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/**
 * Normalize raw custom tag input (form fields, JSON arrays, comma lists) into unique names.
 * Dedupes by slug so "Late Night" and "late-night" become one tag; drops names with an empty slug.
 */
export function parseCustomTagNames(values: unknown[], limit = MAX_CUSTOM_TAGS_PER_ADD): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    for (const part of value.split(",")) {
      const name = part.trim().replace(/\s+/g, " ").slice(0, MAX_CUSTOM_TAG_LENGTH);
      const slug = slugifyTag(name);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      names.push(name);
      if (names.length >= limit) return names;
    }
  }
  return names;
}

/** Committed chips plus any uncommitted draft text from `CustomTagInput`. */
export function withDraft(tags: string[], draft: string): string[] {
  return parseCustomTagNames([...tags, draft]);
}

/** Custom tag names from a form post: repeated `customTags` fields plus legacy single `customTag`. */
export function readCustomTagNamesFromForm(form: FormData): string[] {
  return parseCustomTagNames([...form.getAll("customTags"), ...form.getAll("customTag")]);
}

/** Custom tag names from a JSON body: `customTags: string[]` plus legacy `customTag: string`. */
export function readCustomTagNamesFromJson(body: { customTags?: unknown; customTag?: unknown }): string[] {
  const list = Array.isArray(body.customTags) ? body.customTags : [];
  return parseCustomTagNames([...list, body.customTag]);
}
