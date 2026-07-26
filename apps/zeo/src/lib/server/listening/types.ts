export type ListeningPlaybackState = "idle" | "loading" | "playing" | "paused" | "error";
export type ListeningQueueSource = "library_yt" | "library_ytm" | "search" | "url";

export type ListeningSnapshotSession = {
  id: string;
  roomId: string;
  linkerUserId: string;
  djUserId: string;
  playbackState: ListeningPlaybackState;
  currentQueueItemId: string | null;
  positionMs: number;
  positionUpdatedAt: string;
  playbackGeneration: number;
  errorMessage: string | null;
  botIdentity: string;
  createdAt: string;
  endedAt: string | null;
};

export type ListeningSnapshotQueueItem = {
  id: string;
  sessionId: string;
  position: number;
  videoId: string;
  title: string;
  channelTitle: string | null;
  thumbnailUrl: string | null;
  durationMs: number | null;
  source: ListeningQueueSource;
  addedByUserId: string;
  addedByDisplayName: string;
  createdAt: string;
  /** True when the music worker has already resolved this video's audio URL. */
  prefetched: boolean;
};

export type ListeningSnapshot = {
  version: number;
  serverNow: string;
  session: ListeningSnapshotSession | null;
  currentItem: ListeningSnapshotQueueItem | null;
  queue: ListeningSnapshotQueueItem[];
  /** Video IDs known ready in the worker (for search results, etc.). */
  prefetchedVideoIds: string[];
};
