export type PositionedRow = { id: string; position: number };

/**
 * Updates that renumber rows to 0..n-1 keeping order. Applying them in the returned order never
 * collides with a (parent, position) unique index: each row only moves down into a slot that is
 * already free after the removed rows are gone.
 */
export function planPositionCompaction(rows: PositionedRow[]): PositionedRow[] {
  const sorted = [...rows].sort((a, b) => a.position - b.position);
  const updates: PositionedRow[] = [];
  sorted.forEach((row, index) => {
    if (row.position !== index) updates.push({ id: row.id, position: index });
  });
  return updates;
}

export type SessionPlaybackPatch = {
  currentQueueItemId: string | null;
  playbackState: "idle" | "playing" | "paused";
  positionMs: number;
};

/**
 * Next playback state when the current queue item was removed: continue with the next remaining
 * item after it (same transport state, idle → paused), or go idle when nothing follows.
 */
export function nextPlaybackAfterRemoval(input: {
  removedCurrentPosition: number;
  playbackState: "idle" | "playing" | "paused";
  remaining: PositionedRow[];
}): SessionPlaybackPatch {
  const next = [...input.remaining].sort((a, b) => a.position - b.position).find((row) => row.position > input.removedCurrentPosition) ?? null;
  if (!next) return { currentQueueItemId: null, playbackState: "idle", positionMs: 0 };
  return {
    currentQueueItemId: next.id,
    playbackState: input.playbackState === "idle" ? "paused" : input.playbackState,
    positionMs: 0,
  };
}
