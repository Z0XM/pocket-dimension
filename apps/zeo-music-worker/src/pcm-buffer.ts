/** Concatenate two byte arrays into a fresh buffer. */
export function concatBytes(left: Uint8Array, right: Uint8Array) {
  if (left.byteLength === 0) return right.slice();
  if (right.byteLength === 0) return left.slice();
  const merged = new Uint8Array(left.byteLength + right.byteLength);
  merged.set(left, 0);
  merged.set(right, left.byteLength);
  return merged;
}

export type PendingPcm = {
  bytes: Uint8Array;
  offset: number;
};

export function createPendingPcm(): PendingPcm {
  return { bytes: new Uint8Array(0), offset: 0 };
}

export function appendPending(pending: PendingPcm, chunk: Uint8Array) {
  if (chunk.byteLength === 0) return;
  const unread = pending.bytes.byteLength - pending.offset;
  if (unread === 0) {
    pending.bytes = chunk.slice();
    pending.offset = 0;
    return;
  }
  // Drop already-consumed prefix so the buffer cannot grow unboundedly across chunks.
  const kept = pending.bytes.subarray(pending.offset);
  pending.bytes = concatBytes(kept, chunk);
  pending.offset = 0;
}

/** Take one frame-sized copy from pending PCM, or null if not enough bytes remain. */
export function takeFrame(pending: PendingPcm, frameBytes: number): Uint8Array | null {
  if (pending.bytes.byteLength - pending.offset < frameBytes) return null;
  const start = pending.offset;
  pending.offset += frameBytes;
  // Copy so callers can retain the frame without pinning the pending buffer.
  return pending.bytes.slice(start, start + frameBytes);
}

export function clearPending(pending: PendingPcm) {
  pending.bytes = new Uint8Array(0);
  pending.offset = 0;
}

/** Drop references held by a warm PCM prebuffer after it has been consumed or cancelled. */
export function releaseWarmFrames(frames: Uint8Array[]) {
  frames.length = 0;
}
