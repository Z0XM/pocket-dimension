export type ByteRangeResult = { type: "full" } | { type: "partial"; start: number; end: number } | { type: "unsatisfiable" };

/**
 * Parse a single HTTP Range request for byte serving.
 * Prefers serving the full body over 416 when the header is missing/malformed
 * or size is unknown/empty — HTML5 <audio> often sends `bytes=0-` on first play.
 */
export function parseBytesRange(rangeHeader: string | null | undefined, size: number): ByteRangeResult {
  if (!Number.isFinite(size) || size <= 0) return { type: "full" };
  if (!rangeHeader) return { type: "full" };

  // Only honor a single simple range (browsers typically send one).
  const raw = rangeHeader.trim();
  const m = /^bytes=(\d*)-(\d*)$/i.exec(raw);
  if (!m) return { type: "full" };

  const startTok = m[1];
  const endTok = m[2];
  const hasStart = startTok !== "";
  const hasEnd = endTok !== "";

  if (!hasStart && !hasEnd) return { type: "full" };

  let start: number;
  let end: number;

  if (!hasStart) {
    // suffix bytes=-N
    const suffix = Number(endTok);
    if (!Number.isFinite(suffix) || suffix <= 0) return { type: "full" };
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = Number(startTok);
    end = hasEnd ? Number(endTok) : size - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return { type: "full" };
    if (start < 0) start = 0;
    // Clamp open/overshooting end (RFC allows servers to adjust)
    if (end >= size) end = size - 1;
  }

  if (start >= size) return { type: "unsatisfiable" };
  if (start > end) return { type: "unsatisfiable" };

  return { type: "partial", start, end };
}
