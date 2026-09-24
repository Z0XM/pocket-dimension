import { db, schema } from "@pocket-dimension/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  findDuplicateClusters,
  type DuplicateCluster,
  type DuplicateTier,
  DEFAULT_FUZZY_THRESHOLD,
} from "./normalize";
import {
  planRatingMerges,
  type MergeStrategy,
  type RatingSnapshot,
} from "./merge-ratings";

export type { MergeStrategy, DuplicateTier };

export type ClusterWithStats = DuplicateCluster & {
  dismissed: boolean;
  totalRatings: number;
  sampleRaters: string[];
  memberStats: Array<{
    id: string;
    title: string;
    type: string;
    language: string | null;
    ratingCount: number;
  }>;
};

async function loadCatalogItems() {
  const rows = await db
    .select({
      id: schema.watchItems.id,
      title: schema.watchItems.title,
      type: schema.watchItems.type,
      languageId: schema.watchItems.languageId,
      language: schema.watchLanguages.language,
    })
    .from(schema.watchItems)
    .leftJoin(schema.watchLanguages, eq(schema.watchItems.languageId, schema.watchLanguages.id));

  return rows;
}

async function loadDismissedFingerprints(): Promise<Set<string>> {
  const rows = await db.select({ fingerprint: schema.duplicateDismissals.fingerprint }).from(schema.duplicateDismissals);
  return new Set(rows.map((r) => r.fingerprint));
}

async function attachStats(clusters: DuplicateCluster[], dismissed: Set<string>): Promise<ClusterWithStats[]> {
  if (clusters.length === 0) return [];

  const allIds = [...new Set(clusters.flatMap((c) => c.members.map((m) => m.id)))];
  if (allIds.length === 0) return [];

  const ratingRows = await db
    .select({
      watchItemId: schema.watchItemRatings.watchItemId,
      userId: schema.watchItemRatings.userId,
      username: schema.user.username,
    })
    .from(schema.watchItemRatings)
    .leftJoin(schema.user, eq(schema.watchItemRatings.userId, schema.user.id))
    .where(inArray(schema.watchItemRatings.watchItemId, allIds));

  const countByItem = new Map<string, number>();
  const ratersByItem = new Map<string, string[]>();
  for (const r of ratingRows) {
    countByItem.set(r.watchItemId, (countByItem.get(r.watchItemId) ?? 0) + 1);
    if (r.username) {
      const list = ratersByItem.get(r.watchItemId) ?? [];
      if (!list.includes(r.username)) list.push(r.username);
      ratersByItem.set(r.watchItemId, list);
    }
  }

  return clusters.map((c) => {
    const memberStats = c.members.map((m) => ({
      id: m.id,
      title: m.title,
      type: m.type,
      language: m.language,
      ratingCount: countByItem.get(m.id) ?? 0,
    }));
    const sampleRaters = [
      ...new Set(c.members.flatMap((m) => (ratersByItem.get(m.id) ?? []).slice(0, 4))),
    ].slice(0, 8);
    return {
      ...c,
      dismissed: dismissed.has(c.fingerprint),
      totalRatings: memberStats.reduce((n, m) => n + m.ratingCount, 0),
      sampleRaters,
      memberStats,
    };
  });
}

export async function listDuplicateSuggestions(options: {
  tier?: DuplicateTier | "all";
  includeDismissed?: boolean;
  fuzzyThreshold?: number;
} = {}): Promise<ClusterWithStats[]> {
  const [items, dismissed] = await Promise.all([loadCatalogItems(), loadDismissedFingerprints()]);
  let clusters = findDuplicateClusters(items, {
    fuzzyThreshold: options.fuzzyThreshold ?? DEFAULT_FUZZY_THRESHOLD,
  });

  if (options.tier && options.tier !== "all") {
    clusters = clusters.filter((c) => c.tier === options.tier);
  }

  const withStats = await attachStats(clusters, dismissed);
  if (options.includeDismissed) return withStats;
  return withStats.filter((c) => !c.dismissed);
}

export async function previewMerge(params: {
  keepId: string;
  mergeIds: string[];
  strategy: MergeStrategy;
}) {
  const { keepId, mergeIds, strategy } = params;
  const allIds = [...new Set([keepId, ...mergeIds])];
  if (!allIds.includes(keepId) || mergeIds.length === 0) {
    throw new Error("keepId and at least one mergeId are required");
  }
  if (mergeIds.includes(keepId)) {
    throw new Error("mergeIds must not include keepId");
  }

  const items = await db
    .select({
      id: schema.watchItems.id,
      title: schema.watchItems.title,
      type: schema.watchItems.type,
      language: schema.watchLanguages.language,
    })
    .from(schema.watchItems)
    .leftJoin(schema.watchLanguages, eq(schema.watchItems.languageId, schema.watchLanguages.id))
    .where(inArray(schema.watchItems.id, allIds));

  if (items.length !== allIds.length) {
    throw new Error("One or more catalog items were not found");
  }

  const ratingsRaw = await db
    .select({
      id: schema.watchItemRatings.id,
      watchItemId: schema.watchItemRatings.watchItemId,
      userId: schema.watchItemRatings.userId,
      rating: schema.watchItemRatings.rating,
      infinity: schema.watchItemRatings.infinity,
      shitty: schema.watchItemRatings.shitty,
      recommendation: schema.watchItemRatings.recommendation,
      review: schema.watchItemRatings.review,
      progressStatus: schema.watchItemRatings.progressStatus,
      droppedAtSeason: schema.watchItemRatings.droppedAtSeason,
      droppedAtEpisode: schema.watchItemRatings.droppedAtEpisode,
      updatedAt: schema.watchItemRatings.updatedAt,
      username: schema.user.username,
    })
    .from(schema.watchItemRatings)
    .leftJoin(schema.user, eq(schema.watchItemRatings.userId, schema.user.id))
    .where(inArray(schema.watchItemRatings.watchItemId, allIds));

  const usernames = new Map<string, string | null>();
  const ratings: RatingSnapshot[] = ratingsRaw.map((r) => {
    usernames.set(r.userId, r.username);
    return {
      id: r.id,
      watchItemId: r.watchItemId,
      userId: r.userId,
      rating: r.rating,
      infinity: r.infinity,
      shitty: r.shitty,
      recommendation: r.recommendation,
      review: r.review,
      progressStatus: r.progressStatus,
      droppedAtSeason: r.droppedAtSeason,
      droppedAtEpisode: r.droppedAtEpisode,
      updatedAt: r.updatedAt,
    };
  });

  const plan = planRatingMerges(ratings, keepId, strategy, usernames);
  const keep = items.find((i) => i.id === keepId)!;
  const losers = items.filter((i) => i.id !== keepId);

  return {
    keep,
    losers,
    strategy,
    conflictCount: plan.conflictCount,
    conflicts: plan.conflicts.map((c) => ({
      userId: c.userId,
      username: c.username,
      chosenRatingId: c.chosenRatingId,
      ratings: c.ratings.map((r) => ({
        id: r.id,
        watchItemId: r.watchItemId,
        title: items.find((i) => i.id === r.watchItemId)?.title,
        rating: r.rating,
        infinity: r.infinity,
        shitty: r.shitty,
        progressStatus: r.progressStatus,
        recommendation: r.recommendation,
        updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
      })),
    })),
    userCount: plan.plans.length,
    ratingRowCount: ratings.length,
  };
}

export async function executeMerge(params: {
  keepId: string;
  mergeIds: string[];
  strategy: MergeStrategy;
  adminUserId: string;
}) {
  const { keepId, mergeIds, strategy, adminUserId } = params;
  const preview = await previewMerge({ keepId, mergeIds, strategy });
  const allIds = [keepId, ...mergeIds];

  const ratingsRaw = await db
    .select({
      id: schema.watchItemRatings.id,
      watchItemId: schema.watchItemRatings.watchItemId,
      userId: schema.watchItemRatings.userId,
      rating: schema.watchItemRatings.rating,
      infinity: schema.watchItemRatings.infinity,
      shitty: schema.watchItemRatings.shitty,
      recommendation: schema.watchItemRatings.recommendation,
      review: schema.watchItemRatings.review,
      progressStatus: schema.watchItemRatings.progressStatus,
      droppedAtSeason: schema.watchItemRatings.droppedAtSeason,
      droppedAtEpisode: schema.watchItemRatings.droppedAtEpisode,
      updatedAt: schema.watchItemRatings.updatedAt,
    })
    .from(schema.watchItemRatings)
    .where(inArray(schema.watchItemRatings.watchItemId, allIds));

  const plan = planRatingMerges(ratingsRaw, keepId, strategy);

  await db.transaction(async (tx) => {
    // Apply rating winners onto keep item
    for (const p of plan.plans) {
      const winner = p.keepRating;
      const onKeep = ratingsRaw.find((r) => r.userId === p.userId && r.watchItemId === keepId);

      if (winner.watchItemId === keepId) {
        // Winner already on keep — delete other rows for this user
        if (p.dropRatingIds.length > 0) {
          await tx.delete(schema.watchItemRatings).where(inArray(schema.watchItemRatings.id, p.dropRatingIds));
        }
        continue;
      }

      // Winner is on a loser row — move onto keep (update existing or re-point)
      if (onKeep) {
        await tx
          .update(schema.watchItemRatings)
          .set({
            rating: winner.rating,
            infinity: winner.infinity,
            shitty: winner.shitty,
            recommendation: winner.recommendation as any,
            review: winner.review,
            progressStatus: winner.progressStatus as any,
            droppedAtSeason: winner.droppedAtSeason,
            droppedAtEpisode: winner.droppedAtEpisode,
            updatedById: adminUserId,
            updatedAt: sql`now()`,
          })
          .where(eq(schema.watchItemRatings.id, onKeep.id));

        // Delete all other rows for this user across merge set (including winner source)
        const toDelete = ratingsRaw.filter((r) => r.userId === p.userId && r.id !== onKeep.id).map((r) => r.id);
        if (toDelete.length > 0) {
          await tx.delete(schema.watchItemRatings).where(inArray(schema.watchItemRatings.id, toDelete));
        }
      } else {
        // No rating on keep — move winner row to keep item
        await tx
          .update(schema.watchItemRatings)
          .set({
            watchItemId: keepId,
            updatedById: adminUserId,
            updatedAt: sql`now()`,
          })
          .where(eq(schema.watchItemRatings.id, winner.id));

        if (p.dropRatingIds.length > 0) {
          await tx.delete(schema.watchItemRatings).where(inArray(schema.watchItemRatings.id, p.dropRatingIds));
        }
      }
    }

    // Move tags from losers onto keep (ignore conflicts)
    const loserTags = await tx
      .select()
      .from(schema.watchItemTags)
      .where(inArray(schema.watchItemTags.watchItemId, mergeIds));

    for (const tag of loserTags) {
      const existing = await tx
        .select({ id: schema.watchItemTags.id })
        .from(schema.watchItemTags)
        .where(and(eq(schema.watchItemTags.watchItemId, keepId), eq(schema.watchItemTags.watchTagId, tag.watchTagId)))
        .limit(1);
      if (existing.length === 0) {
        await tx
          .update(schema.watchItemTags)
          .set({ watchItemId: keepId, updatedById: adminUserId, updatedAt: sql`now()` })
          .where(eq(schema.watchItemTags.id, tag.id));
      }
    }

    // Delete loser catalog rows (cascades remaining ratings/tags)
    await tx.delete(schema.watchItems).where(inArray(schema.watchItems.id, mergeIds));

    // Clear dismissals that referenced any of these ids
    await clearDismissalsTouching(tx, allIds);

    await tx
      .update(schema.watchItems)
      .set({ updatedById: adminUserId, updatedAt: sql`now()` })
      .where(eq(schema.watchItems.id, keepId));
  });

  return {
    ok: true as const,
    keepId,
    deletedIds: mergeIds,
    conflictCount: preview.conflictCount,
    strategy,
  };
}

export async function executeDeleteOthers(params: {
  keepId: string;
  deleteIds: string[];
  adminUserId: string;
}) {
  const { keepId, deleteIds, adminUserId } = params;
  if (deleteIds.includes(keepId)) {
    throw new Error("deleteIds must not include keepId");
  }
  if (deleteIds.length === 0) {
    throw new Error("deleteIds required");
  }

  const existing = await db
    .select({ id: schema.watchItems.id })
    .from(schema.watchItems)
    .where(inArray(schema.watchItems.id, [keepId, ...deleteIds]));
  if (existing.length !== deleteIds.length + 1) {
    throw new Error("One or more catalog items were not found");
  }

  // Deleting losers cascades their ratings — intentional for keep/delete path
  await db.transaction(async (tx) => {
    await tx.delete(schema.watchItems).where(inArray(schema.watchItems.id, deleteIds));
    await clearDismissalsTouching(tx, [keepId, ...deleteIds]);
    await tx
      .update(schema.watchItems)
      .set({ updatedById: adminUserId, updatedAt: sql`now()` })
      .where(eq(schema.watchItems.id, keepId));
  });

  return { ok: true as const, keepId, deletedIds: deleteIds };
}

export async function dismissCluster(params: {
  fingerprint: string;
  itemIds: string[];
  tier: DuplicateTier;
  reason?: string | null;
  adminUserId: string;
}) {
  const fingerprint = params.fingerprint || clusterFp(params.itemIds);
  const existing = await db
    .select({ id: schema.duplicateDismissals.id })
    .from(schema.duplicateDismissals)
    .where(eq(schema.duplicateDismissals.fingerprint, fingerprint))
    .limit(1);

  if (existing.length > 0) {
    return { ok: true as const, fingerprint, alreadyDismissed: true };
  }

  await db.insert(schema.duplicateDismissals).values({
    fingerprint,
    itemIds: params.itemIds,
    tier: params.tier,
    reason: params.reason ?? null,
    createdById: params.adminUserId,
    updatedById: params.adminUserId,
  });

  return { ok: true as const, fingerprint, alreadyDismissed: false };
}

export async function undismissCluster(fingerprint: string) {
  await db.delete(schema.duplicateDismissals).where(eq(schema.duplicateDismissals.fingerprint, fingerprint));
  return { ok: true as const };
}

function clusterFp(ids: string[]) {
  return [...ids].sort().join("|");
}

async function clearDismissalsTouching(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  itemIds: string[]
) {
  const rows = await tx.select().from(schema.duplicateDismissals);
  const toDelete: string[] = [];
  for (const row of rows) {
    const ids = Array.isArray(row.itemIds) ? (row.itemIds as string[]) : [];
    if (ids.some((id) => itemIds.includes(id)) || itemIds.some((id) => row.fingerprint.includes(id))) {
      toDelete.push(row.id);
    }
  }
  if (toDelete.length > 0) {
    await tx.delete(schema.duplicateDismissals).where(inArray(schema.duplicateDismissals.id, toDelete));
  }
}
