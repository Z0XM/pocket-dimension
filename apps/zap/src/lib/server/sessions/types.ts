export type SessionPlaybackState = "idle" | "playing" | "paused";
export type SessionMemberRole = "host" | "guest";

export type SessionSnapshotSession = {
  id: string;
  hostUserId: string;
  joinCode: string;
  status: "live" | "ended";
  playbackState: SessionPlaybackState;
  currentQueueItemId: string | null;
  positionMs: number;
  positionUpdatedAt: string;
  playbackGeneration: number;
  guestsCanAdd: boolean;
  guestsCanControl: boolean;
  autoPlay: boolean;
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
    canControl: boolean;
    canManageGuests: boolean;
  } | null;
};
