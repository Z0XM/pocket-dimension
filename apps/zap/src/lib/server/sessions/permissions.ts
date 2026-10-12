import type { SessionMemberRole } from "./types";

export type PermissionFlags = {
  guestsCanAdd: boolean;
  guestsCanControl: boolean;
};

export function canAddToQueue(role: SessionMemberRole | null, flags: PermissionFlags): boolean {
  if (!role) return false;
  if (role === "host") return true;
  return flags.guestsCanAdd;
}

export function canControlTransport(role: SessionMemberRole | null, flags: PermissionFlags): boolean {
  if (!role) return false;
  if (role === "host") return true;
  return flags.guestsCanControl;
}

export function canManageGuestPermissions(role: SessionMemberRole | null): boolean {
  return role === "host";
}

export function canEndSession(role: SessionMemberRole | null): boolean {
  return role === "host";
}
