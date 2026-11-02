import { parseTagQuery, collectTagNames } from "$lib/tag-query";
import type { TagFilterTag } from "$lib/tag-filter";

export type PlaylistSectionId = "all" | "custom" | "following" | "linked" | "saved" | "connected";

export const PLAYLIST_SECTIONS: { id: PlaylistSectionId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "custom", label: "Custom" },
  { id: "following", label: "Following" },
  { id: "linked", label: "Linked" },
  { id: "saved", label: "Saved" },
  { id: "connected", label: "Connected" },
];

export type PlaylistListItem = {
  id: string;
  name: string;
  tagQuery: string | null;
  kind: "standard" | "linked";
  relation: "owner" | "collaborator" | "follower" | "linked_member" | "viewer";
  trackCount: number;
  canDelete: boolean;
  visibility: "private" | "public";
};

/** Which index tab a Zap playlist belongs in (saved/connected are separate data sources). */
export function sectionForPlaylist(pl: Pick<PlaylistListItem, "kind" | "relation">): Exclude<PlaylistSectionId, "all" | "saved" | "connected"> {
  if (pl.kind === "linked") return "linked";
  if (pl.relation === "follower") return "following";
  return "custom";
}

export function filterPlaylistsBySection(playlists: PlaylistListItem[], section: PlaylistSectionId): PlaylistListItem[] {
  if (section === "all") return playlists;
  if (section === "saved" || section === "connected") return [];
  return playlists.filter((p) => sectionForPlaylist(p) === section);
}

export function filterByNameSearch<T extends { name?: string; title?: string }>(items: T[], q: string): T[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((i) => (i.name ?? i.title ?? "").toLowerCase().includes(needle));
}

/** Resolve tag chips for a stored playlist tag query (positive tag names only). */
export function tagsFromPlaylistQuery(tagQuery: string | null | undefined, availableTags: TagFilterTag[]): TagFilterTag[] {
  if (!tagQuery?.trim()) return [];
  const parsed = parseTagQuery(tagQuery);
  if (!parsed.ok) return [];
  const names = collectTagNames(parsed.ast);
  const byKey = new Map<string, TagFilterTag>();
  for (const t of availableTags) {
    byKey.set(t.name.toLowerCase(), t);
    if (t.slug) byKey.set(t.slug.toLowerCase(), t);
  }
  const out: TagFilterTag[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const tag = byKey.get(name);
    if (!tag || seen.has(tag.id)) continue;
    seen.add(tag.id);
    out.push(tag);
  }
  return out;
}
