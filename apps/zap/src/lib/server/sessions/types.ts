export type SessionPlaybackState = "idle" | "playing" | "paused";
export type SessionMemberRole = "host" | "guest";
export type SessionStatus = "live" | "ended";

export type SessionMemberPermissions = {
  canAdd: boolean;
  canPlayPause: boolean;
  canSkip: boolean;
  canSeek: boolean;
  canReorder: boolean;
  canSetup: boolean;
};

export type SessionSnapshotSession = {
  id: string;
  hostUserId: string;
  joinCode: string;
  name: string;
  status: SessionStatus;
  playbackState: SessionPlaybackState;
  currentQueueItemId: string | null;
  positionMs: number;
  positionUpdatedAt: string;
  playbackGeneration: number;
  autoPlay: boolean;
  perpetual: boolean;
  /** ISO timestamp when perpetual session went idle; null while active. */
  staleAt: string | null;
  lastActivityAt: string;
  createdAt: string;
  endedAt: string | null;
};

export type SessionSnapshotMember = {
  id: string;
  userId: string;
  role: SessionMemberRole;
  displayName: string;
  joinedAt: string;
  permissions: SessionMemberPermissions;
  outputEnabled: boolean;
  volume: number;
};

export type SessionSnapshotQueueItem = {
  id: string;
  sessionId: string;
  position: number;
  mediaAssetId: string;
  title: string;
  artists: string | null;
  durationMs: number | null;
  playable: boolean;
  addedByUserId: string;
  addedByDisplayName: string;
  createdAt: string;
};

export type SessionSnapshot = {
  version: number;
  serverNow: string;
  session: SessionSnapshotSession | null;
  currentItem: SessionSnapshotQueueItem | null;
  queue: SessionSnapshotQueueItem[];
  members: SessionSnapshotMember[];
  /** Effective permissions for the requesting user (if known). */
  me: {
    userId: string;
    role: SessionMemberRole | null;
    canAdd: boolean;
    canPlayPause: boolean;
    canSkip: boolean;
    canSeek: boolean;
    canReorder: boolean;
    canSetup: boolean;
    /** playPause || skip || seek — for compact UI chrome. */
    canControl: boolean;
    canManageGuests: boolean;
  } | null;
};
