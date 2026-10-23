/** Short list/meta badge for how a playlist relates to the current user. */
export function playlistRelationBadge(
  relation: "owner" | "collaborator" | "follower" | "linked_member" | "viewer" | undefined,
  kind: "standard" | "linked" | undefined
): string | null {
  if (kind === "linked") return "Linked";
  if (relation === "follower") return "Followed";
  if (relation === "collaborator") return "Collaborator";
  if (relation === "linked_member") return "Linked";
  return null;
}
