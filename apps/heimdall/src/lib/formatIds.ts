/** Epic chip / heading label. With `idPrefix` → `H1`; else parser `code` or bare number. */
export function formatEpicId(epic: { code?: string; number: number; idPrefix?: string }): string {
  const prefix = epic.idPrefix?.trim();
  if (prefix) return `${prefix}${epic.number}`;
  return epic.code ?? String(epic.number);
}

/** Story id label. With `idPrefix` → `H1.2`; else parser `code` or `n.m`. */
export function formatStoryId(story: { code?: string; epicNumber: number; number: number; idPrefix?: string }): string {
  const prefix = story.idPrefix?.trim();
  const bare = `${story.epicNumber}.${story.number}`;
  if (prefix) return `${prefix}${bare}`;
  return story.code ?? bare;
}

/** Raw numeric labels for search (always without prefix). */
export function bareEpicId(epic: { number: number }): string {
  return String(epic.number);
}

export function bareStoryId(story: { epicNumber: number; number: number }): string {
  return `${story.epicNumber}.${story.number}`;
}
