import type { SessionSnapshot } from "$lib/server/sessions/types";

export type DiscordPlaybackCommand =
  | { action: "idle" }
  | { action: "play"; mediaAssetId: string; positionMs: number; generation: number }
  | { action: "pause"; positionMs: number; generation: number };

/**
 * Pure mapping from session snapshot → Discord voice player command.
 * Keeps transport authority on the Zap session timeline.
 */
export function playbackCommandFromSnapshot(snapshot: SessionSnapshot): DiscordPlaybackCommand {
  const session = snapshot.session;
  if (!session || session.status !== "live") return { action: "idle" };

  const item = snapshot.currentItem;
  if (!item?.playable || !item.mediaAssetId) return { action: "idle" };

  if (session.playbackState === "playing") {
    let positionMs = session.positionMs;
    const updatedAt = new Date(session.positionUpdatedAt).getTime();
    if (Number.isFinite(updatedAt)) {
      positionMs = Math.max(0, session.positionMs + (Date.now() - updatedAt));
    }
    return {
      action: "play",
      mediaAssetId: item.mediaAssetId,
      positionMs,
      generation: session.playbackGeneration,
    };
  }

  if (session.playbackState === "paused") {
    return {
      action: "pause",
      positionMs: session.positionMs,
      generation: session.playbackGeneration,
    };
  }

  return { action: "idle" };
}

export function shouldResync(prevGen: number | null, nextGen: number, prevAsset: string | null, nextAsset: string) {
  return prevGen !== nextGen || prevAsset !== nextAsset;
}
