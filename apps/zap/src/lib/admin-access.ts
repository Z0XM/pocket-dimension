export type PortalAccessMode = "open" | "allowlist";
export type UserAccessStatus = "default" | "allowed" | "blocked";
/** Effective outcome for one request. `pending` = allowlist mode and not yet allowed. */
export type PortalAccess = "admin" | "allowed" | "blocked" | "pending";

export const PORTAL_ACCESS_MODES: readonly PortalAccessMode[] = ["open", "allowlist"];
export const USER_ACCESS_STATUSES: readonly UserAccessStatus[] = ["default", "allowed", "blocked"];

export function parsePortalAccessMode(raw: string | null | undefined): PortalAccessMode {
  return raw === "allowlist" ? "allowlist" : "open";
}

export function parseUserAccessStatus(raw: string | null | undefined): UserAccessStatus | null {
  return raw === "default" || raw === "allowed" || raw === "blocked" ? raw : null;
}

/** Admins are never blocked; explicit status wins over the portal mode. */
export function resolvePortalAccess(input: { isAdmin: boolean; status: UserAccessStatus; mode: PortalAccessMode }): PortalAccess {
  if (input.isAdmin) return "admin";
  if (input.status === "blocked") return "blocked";
  if (input.status === "allowed") return "allowed";
  return input.mode === "allowlist" ? "pending" : "allowed";
}

export function canUsePortal(access: PortalAccess): boolean {
  return access === "admin" || access === "allowed";
}

/**
 * Routes a blocked/pending user may not use: every page in `(protected)` and every Zap API
 * (including the media stream and YouTube OAuth). Auth pages, `/blocked`, `/health` and `/` stay reachable.
 */
export function isPortalGatedRoute(routeId: string | null | undefined, pathname: string): boolean {
  if (routeId?.startsWith("/(protected)")) return true;
  return pathname === "/api" || pathname.startsWith("/api/");
}

export type AccessChange = { kind: "status"; status: UserAccessStatus } | { kind: "admin"; isAdmin: boolean };

/** Guardrails for admin edits. Returns an error message, or null when the change is allowed. */
export function validateAccessChange(input: {
  actorUserId: string;
  targetUserId: string;
  targetIsAdmin: boolean;
  change: AccessChange;
}): string | null {
  const self = input.actorUserId === input.targetUserId;
  if (input.change.kind === "admin") {
    if (self && !input.change.isAdmin) return "You can't remove your own admin role — ask another admin.";
    return null;
  }
  if (input.change.status === "blocked") {
    if (self) return "You can't block yourself.";
    if (input.targetIsAdmin) return "Remove admin first — admins can't be blocked.";
  }
  return null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Guards `uuid` columns so malformed ids become 404s instead of Postgres cast errors. */
export function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** How often (ms) a request refreshes `user_access.last_seen_at` for the same user. */
export const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

export function shouldTouchLastSeen(lastSeenAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!lastSeenAt) return true;
  return now.getTime() - lastSeenAt.getTime() >= LAST_SEEN_THROTTLE_MS;
}
