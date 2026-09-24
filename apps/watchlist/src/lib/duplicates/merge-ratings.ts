/**
 * Rating merge strategies when collapsing duplicate catalog rows.
 */

export type MergeStrategy = "prefer_kept" | "prefer_highest" | "prefer_recent";

export type RatingSnapshot = {
  id: string;
  watchItemId: string;
  userId: string;
  rating: string | null;
  infinity: boolean | null;
  shitty: boolean | null;
  recommendation: string | null;
  review: string | null;
  progressStatus: string | null;
  droppedAtSeason: number | null;
  droppedAtEpisode: number | null;
  updatedAt: Date | string | null;
};

export type RatingConflict = {
  userId: string;
  username?: string | null;
  ratings: RatingSnapshot[];
  /** Which rating would win under the given strategy (by rating id). */
  chosenRatingId: string | null;
};

const PROGRESS_RANK: Record<string, number> = {
  watched: 4,
  watching: 3,
  watch_later: 2,
  dropped: 1,
};

function ratingNumeric(r: RatingSnapshot): number {
  if (r.infinity) return Number.POSITIVE_INFINITY;
  if (r.shitty) return Number.NEGATIVE_INFINITY;
  if (r.rating == null || r.rating === "") return Number.NaN;
  const n = Number(r.rating);
  return Number.isFinite(n) ? n : Number.NaN;
}

function updatedAtMs(r: RatingSnapshot): number {
  if (!r.updatedAt) return 0;
  const t = r.updatedAt instanceof Date ? r.updatedAt.getTime() : new Date(r.updatedAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

function progressRank(r: RatingSnapshot): number {
  return PROGRESS_RANK[r.progressStatus ?? ""] ?? 0;
}

/** True when two ratings for the same user meaningfully disagree. */
export function ratingsDisagree(a: RatingSnapshot, b: RatingSnapshot): boolean {
  if (a.rating !== b.rating) return true;
  if (Boolean(a.infinity) !== Boolean(b.infinity)) return true;
  if (Boolean(a.shitty) !== Boolean(b.shitty)) return true;
  if ((a.recommendation ?? null) !== (b.recommendation ?? null)) return true;
  if ((a.progressStatus ?? null) !== (b.progressStatus ?? null)) return true;
  if ((a.review ?? "") !== (b.review ?? "")) return true;
  return false;
}

export function chooseRating(ratings: RatingSnapshot[], keepItemId: string, strategy: MergeStrategy): RatingSnapshot | null {
  if (ratings.length === 0) return null;
  if (ratings.length === 1) return ratings[0];

  if (strategy === "prefer_kept") {
    const onKept = ratings.find((r) => r.watchItemId === keepItemId);
    if (onKept) return onKept;
    // Fall through to most recent if no rating on kept row
    return [...ratings].sort((a, b) => updatedAtMs(b) - updatedAtMs(a))[0];
  }

  if (strategy === "prefer_highest") {
    return [...ratings].sort((a, b) => {
      const na = ratingNumeric(a);
      const nb = ratingNumeric(b);
      const aNan = Number.isNaN(na);
      const bNan = Number.isNaN(nb);
      if (!aNan && !bNan && na !== nb) return nb > na ? 1 : -1;
      if (!aNan && bNan) return -1;
      if (aNan && !bNan) return 1;
      const pr = progressRank(b) - progressRank(a);
      if (pr !== 0) return pr;
      // Prefer kept on remaining ties
      if (a.watchItemId === keepItemId && b.watchItemId !== keepItemId) return -1;
      if (b.watchItemId === keepItemId && a.watchItemId !== keepItemId) return 1;
      return updatedAtMs(b) - updatedAtMs(a);
    })[0];
  }

  // prefer_recent
  return [...ratings].sort((a, b) => {
    const dt = updatedAtMs(b) - updatedAtMs(a);
    if (dt !== 0) return dt;
    if (a.watchItemId === keepItemId && b.watchItemId !== keepItemId) return -1;
    if (b.watchItemId === keepItemId && a.watchItemId !== keepItemId) return 1;
    return 0;
  })[0];
}

/**
 * Group ratings by user across mergeable items and pick winners.
 */
export function planRatingMerges(
  ratings: RatingSnapshot[],
  keepItemId: string,
  strategy: MergeStrategy,
  usernames?: Map<string, string | null>
): {
  conflicts: RatingConflict[];
  conflictCount: number;
  plans: Array<{ userId: string; keepRating: RatingSnapshot; dropRatingIds: string[] }>;
} {
  const byUser = new Map<string, RatingSnapshot[]>();
  for (const r of ratings) {
    const list = byUser.get(r.userId) ?? [];
    list.push(r);
    byUser.set(r.userId, list);
  }

  const conflicts: RatingConflict[] = [];
  const plans: Array<{ userId: string; keepRating: RatingSnapshot; dropRatingIds: string[] }> = [];

  for (const [userId, userRatings] of byUser) {
    const chosen = chooseRating(userRatings, keepItemId, strategy);
    if (!chosen) continue;

    const dropRatingIds = userRatings.filter((r) => r.id !== chosen.id).map((r) => r.id);
    plans.push({ userId, keepRating: chosen, dropRatingIds });

    if (userRatings.length >= 2) {
      let disagrees = false;
      for (let i = 0; i < userRatings.length; i++) {
        for (let j = i + 1; j < userRatings.length; j++) {
          if (ratingsDisagree(userRatings[i], userRatings[j])) {
            disagrees = true;
            break;
          }
        }
        if (disagrees) break;
      }
      if (disagrees) {
        conflicts.push({
          userId,
          username: usernames?.get(userId) ?? null,
          ratings: userRatings,
          chosenRatingId: chosen.id,
        });
      }
    }
  }

  return { conflicts, conflictCount: conflicts.length, plans };
}
