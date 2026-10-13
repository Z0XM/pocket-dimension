/**
 * Auto-play next-track scoring for Zap sessions.
 * Prefer tracks that share tags with recent queue seeds, avoid recent plays / queue dupes.
 */

export type AutoPlayCandidate = {
  id: string;
  title: string;
  /** Tag ids the requesting user has on this asset (empty ok). */
  tagIds: string[];
  /** Milliseconds since last play by this user (Infinity if never). */
  msSinceLastPlay: number;
  addedByOther: boolean;
};

export type AutoPlaySeed = {
  /** Tag ids observed on recent queue / now-playing tracks. */
  seedTagIds: string[];
  /** Asset ids already in queue or recently played — excluded. */
  excludeAssetIds: Set<string>;
};

export function scoreAutoPlayCandidate(candidate: AutoPlayCandidate, seed: AutoPlaySeed): number {
  if (seed.excludeAssetIds.has(candidate.id)) return Number.NEGATIVE_INFINITY;

  const seedTags = new Set(seed.seedTagIds);
  let shared = 0;
  for (const t of candidate.tagIds) {
    if (seedTags.has(t)) shared += 1;
  }

  // Shared tags dominate; recency (not played lately) + mild social signal.
  const recencyBoost = Math.min(candidate.msSinceLastPlay / (1000 * 60 * 60 * 24), 14); // cap ~2 weeks
  const social = candidate.addedByOther ? 0.5 : 0;
  return shared * 10 + recencyBoost + social;
}

/** Pick best candidate; null if none score finite. */
export function pickAutoPlayTrack(candidates: AutoPlayCandidate[], seed: AutoPlaySeed): AutoPlayCandidate | null {
  let best: AutoPlayCandidate | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const c of candidates) {
    const s = scoreAutoPlayCandidate(c, seed);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  if (!best || !Number.isFinite(bestScore)) return null;
  return best;
}
