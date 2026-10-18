export const ADMIN_ACTIVITY_KINDS = ["play", "session_started", "session_joined", "import", "upload"] as const;
export type AdminActivityKind = (typeof ADMIN_ACTIVITY_KINDS)[number];

export type AdminActivityEntry = {
  id: string;
  kind: AdminActivityKind;
  /** ISO timestamp. */
  at: string;
  userId: string;
  userLabel: string;
  summary: string;
  detail: string | null;
};

export function parseAdminActivityKind(raw: string | null | undefined): AdminActivityKind | null {
  return (ADMIN_ACTIVITY_KINDS as readonly string[]).includes(raw ?? "") ? (raw as AdminActivityKind) : null;
}

/** Newest first across sources; ties broken by id so paging with `before` stays stable. */
export function mergeActivity(lists: AdminActivityEntry[][], limit: number): AdminActivityEntry[] {
  return lists
    .flat()
    .sort((a, b) => (a.at === b.at ? (a.id < b.id ? 1 : -1) : a.at < b.at ? 1 : -1))
    .slice(0, limit);
}

export function parseBeforeCursor(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}
