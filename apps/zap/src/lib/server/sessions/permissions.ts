import type { SessionMemberRole } from "./types";

/** Granular guest capabilities (host always has every capability). */
export type SessionCapability = "add" | "playPause" | "skip" | "seek" | "reorder" | "setup";

export type MemberPermissionRow = {
  canAdd: boolean;
  canPlayPause: boolean;
  canSkip: boolean;
  canSeek: boolean;
  canReorder: boolean;
  canSetup: boolean;
};

export const EMPTY_MEMBER_PERMISSIONS: MemberPermissionRow = {
  canAdd: false,
  canPlayPause: false,
  canSkip: false,
  canSeek: false,
  canReorder: false,
  canSetup: false,
};

export type EffectivePermissions = {
  canAdd: boolean;
  canPlayPause: boolean;
  canSkip: boolean;
  canSeek: boolean;
  canReorder: boolean;
  canSetup: boolean;
  /** Convenience: play/pause OR skip OR seek (legacy “can control” chrome). */
  canControl: boolean;
  canManageGuests: boolean;
  canEnd: boolean;
};

export function effectivePermissions(role: SessionMemberRole | null, grants: MemberPermissionRow | null | undefined): EffectivePermissions {
  if (!role) {
    return {
      ...EMPTY_MEMBER_PERMISSIONS,
      canControl: false,
      canManageGuests: false,
      canEnd: false,
    };
  }
  if (role === "host") {
    return {
      canAdd: true,
      canPlayPause: true,
      canSkip: true,
      canSeek: true,
      canReorder: true,
      canSetup: true,
      canControl: true,
      canManageGuests: true,
      canEnd: true,
    };
  }
  const g = grants ?? EMPTY_MEMBER_PERMISSIONS;
  return {
    canAdd: g.canAdd,
    canPlayPause: g.canPlayPause,
    canSkip: g.canSkip,
    canSeek: g.canSeek,
    canReorder: g.canReorder,
    canSetup: g.canSetup,
    canControl: g.canPlayPause || g.canSkip || g.canSeek,
    canManageGuests: g.canSetup,
    canEnd: false,
  };
}

export function canAddToQueue(role: SessionMemberRole | null, grants?: MemberPermissionRow | null): boolean {
  return effectivePermissions(role, grants).canAdd;
}

export function canControlTransport(role: SessionMemberRole | null, grants?: MemberPermissionRow | null): boolean {
  return effectivePermissions(role, grants).canControl;
}

export function canPlayPause(role: SessionMemberRole | null, grants?: MemberPermissionRow | null): boolean {
  return effectivePermissions(role, grants).canPlayPause;
}

export function canSkip(role: SessionMemberRole | null, grants?: MemberPermissionRow | null): boolean {
  return effectivePermissions(role, grants).canSkip;
}

export function canSeek(role: SessionMemberRole | null, grants?: MemberPermissionRow | null): boolean {
  return effectivePermissions(role, grants).canSeek;
}

export function canReorderQueue(role: SessionMemberRole | null, grants?: MemberPermissionRow | null): boolean {
  return effectivePermissions(role, grants).canReorder;
}

export function canManageSetup(role: SessionMemberRole | null, grants?: MemberPermissionRow | null): boolean {
  return effectivePermissions(role, grants).canSetup;
}

/** @deprecated Prefer canManageSetup — setup grant includes guest permission edits. */
export function canManageGuestPermissions(role: SessionMemberRole | null, grants?: MemberPermissionRow | null): boolean {
  return canManageSetup(role, grants);
}

export function canEndSession(role: SessionMemberRole | null): boolean {
  return role === "host";
}
