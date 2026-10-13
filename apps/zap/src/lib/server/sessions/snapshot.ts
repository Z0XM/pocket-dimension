import { db, schema } from "@pocket-dimension/db";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { canAddToQueue, canControlTransport, canManageGuestPermissions } from "./permissions";
import type { SessionSnapshot, SessionSnapshotMember, SessionSnapshotQueueItem, SessionSnapshotSession } from "./types";

function displayName(user: { name: string | null; username: string | null; email: string }): string {
  return user.name?.trim() || user.username?.trim() || user.email;
}

function serializeSession(row: typeof schema.sessions.$inferSelect): SessionSnapshotSession {
  return {
    id: row.id,
    hostUserId: row.hostUserId,
    joinCode: row.joinCode,
    status: row.status,
    playbackState: row.playbackState,
    currentQueueItemId: row.currentQueueItemId,
    positionMs: row.positionMs,
    positionUpdatedAt: row.positionUpdatedAt.toISOString(),
    playbackGeneration: row.playbackGeneration,
    guestsCanAdd: row.guestsCanAdd,
    guestsCanControl: row.guestsCanControl,
    autoPlay: row.autoPlay,
    lastActivityAt: row.lastActivityAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
  };
}

export async function buildSessionSnapshot(sessionId: string, viewerUserId?: string | null): Promise<SessionSnapshot | null> {
  const session = await db.query.sessions.findFirst({
    where: eq(schema.sessions.id, sessionId),
  });
  if (!session) return null;

  const [memberRows, queueRows] = await Promise.all([
    db.query.sessionMembers.findMany({
      where: and(eq(schema.sessionMembers.sessionId, sessionId), isNull(schema.sessionMembers.leftAt)),
    }),
    db.query.queueItems.findMany({
      where: eq(schema.queueItems.sessionId, sessionId),
      orderBy: [asc(schema.queueItems.position), asc(schema.queueItems.createdAt)],
    }),
  ]);

  const userIds = [...new Set([...memberRows.map((m) => m.userId), ...queueRows.map((q) => q.addedByUserId)])];
  const users =
    userIds.length > 0
      ? await db.query.user.findMany({
          where: inArray(schema.user.id, userIds),
        })
      : [];
  const names = new Map(users.map((u) => [u.id, displayName(u)]));

  const assetIds = [...new Set(queueRows.map((q) => q.mediaAssetId))];
  const assets =
    assetIds.length > 0
      ? await db.query.mediaAssets.findMany({
          where: inArray(schema.mediaAssets.id, assetIds),
        })
      : [];
  const assetById = new Map(assets.map((a) => [a.id, a]));

  const queue: SessionSnapshotQueueItem[] = queueRows.map((item) => {
    const asset = assetById.get(item.mediaAssetId);
    return {
      id: item.id,
      sessionId: item.sessionId,
      position: item.position,
      mediaAssetId: item.mediaAssetId,
      title: asset?.title ?? "Unknown track",
      artists: asset?.artists ?? null,
      durationMs: asset?.durationMs ?? null,
      playable: Boolean(asset?.storageKey && asset.status === "ready"),
      addedByUserId: item.addedByUserId,
      addedByDisplayName: names.get(item.addedByUserId) ?? "Listener",
      createdAt: item.createdAt.toISOString(),
    };
  });

  const members: SessionSnapshotMember[] = memberRows.map((m) => ({
    id: m.id,
    userId: m.userId,
    role: m.role,
    displayName: names.get(m.userId) ?? "Listener",
    joinedAt: m.joinedAt.toISOString(),
  }));

  const currentItem = session.currentQueueItemId ? (queue.find((q) => q.id === session.currentQueueItemId) ?? null) : null;

  let me: SessionSnapshot["me"] = null;
  if (viewerUserId) {
    const mine = memberRows.find((m) => m.userId === viewerUserId);
    const role = mine?.role ?? null;
    const flags = { guestsCanAdd: session.guestsCanAdd, guestsCanControl: session.guestsCanControl };
    me = {
      userId: viewerUserId,
      role,
      canAdd: canAddToQueue(role, flags),
      canControl: canControlTransport(role, flags),
      canManageGuests: canManageGuestPermissions(role),
    };
  }

  return {
    version: Date.now(),
    serverNow: new Date().toISOString(),
    session: serializeSession(session),
    currentItem,
    queue,
    members,
    me,
  };
}
