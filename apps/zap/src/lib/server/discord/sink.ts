import { db, schema } from "@pocket-dimension/db";
import { and, eq, isNull } from "drizzle-orm";
import { isLiveSessionIdle } from "$lib/server/idle-session";
import { DISCORD_VOICE_IDLE_MS } from "$lib/server/sessions/idle";
import { sessionEventBus } from "$lib/server/sessions/event-bus";
import type { SessionSnapshot } from "$lib/server/sessions/types";
import { getDiscordClient, listBotGuilds, listGuildVoiceChannels, resolveVoiceChannel } from "./bot";
import { buildDiscordInviteUrl, isDiscordConfigured, parseDiscordSinkConfig, type DiscordSinkConfig } from "./config";
import { logConnectionActivity } from "$lib/server/connections/activity";
import { playbackCommandFromSnapshot } from "./sync";
import {
  applyPlaybackCommand,
  ensureVoiceJoined,
  isVoiceConnected,
  leaveVoice,
  listVoiceSessionIds,
  setVoiceLostHandler,
} from "./voice";

const subscribedSessions = new Set<string>();
let idleSweepTimer: ReturnType<typeof setInterval> | null = null;
const IDLE_SWEEP_MS = 60_000;

export class DiscordSinkError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message);
    this.name = "DiscordSinkError";
  }
}

function ensureConfigured() {
  if (!isDiscordConfigured()) {
    throw new DiscordSinkError("Discord bot is not configured (set DISCORD_BOT_TOKEN + DISCORD_CLIENT_ID)", 503);
  }
}

async function markSinkError(sinkId: string, message: string) {
  await db.update(schema.sessionSinks).set({ status: "error", errorMessage: message }).where(eq(schema.sessionSinks.id, sinkId));
}

async function noteVoiceLost(sessionId: string, reason: string) {
  const sink = await getActiveDiscordSink(sessionId);
  if (!sink) return;
  await db
    .update(schema.sessionSinks)
    .set({ status: "error", errorMessage: reason })
    .where(and(eq(schema.sessionSinks.id, sink.id), isNull(schema.sessionSinks.detachedAt)));
}

function ensureIdleSweep() {
  if (idleSweepTimer) return;
  idleSweepTimer = setInterval(() => {
    void disconnectIdleDiscordVoices().catch((err) => {
      console.warn("[zap discord] idle voice sweep failed", err);
    });
  }, IDLE_SWEEP_MS);
  // Don't keep the process alive solely for the sweeper (Bun/Node).
  idleSweepTimer.unref?.();
}

/** Wire Discord kick/network teardown → sink error row (channel selection kept). */
function ensureVoiceLostWiring() {
  setVoiceLostHandler((sessionId, reason) => {
    void noteVoiceLost(sessionId, reason);
  });
}

async function syncSnapshotToVoice(sessionId: string, snapshot: SessionSnapshot) {
  const sink = await getActiveDiscordSink(sessionId);
  if (!sink) return;
  if (!isVoiceConnected(sessionId)) return;
  try {
    const command = playbackCommandFromSnapshot(snapshot);
    await applyPlaybackCommand(sessionId, command);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Discord playback failed";
    console.error("[zap discord sync]", sessionId, message);
    await markSinkError(sink.id, message);
  }
}

function ensureSubscription(sessionId: string) {
  if (subscribedSessions.has(sessionId)) return;
  subscribedSessions.add(sessionId);
  sessionEventBus.subscribe(sessionId, (snapshot) => {
    void syncSnapshotToVoice(sessionId, snapshot);
    if (snapshot.session?.status === "ended" || snapshot.session?.endedAt) {
      void detachDiscordSink(sessionId, { reason: "session_ended" });
    }
  });
}

export async function getActiveDiscordSink(sessionId: string) {
  return db.query.sessionSinks.findFirst({
    where: and(eq(schema.sessionSinks.sessionId, sessionId), eq(schema.sessionSinks.type, "discord"), isNull(schema.sessionSinks.detachedAt)),
  });
}

export async function describeDiscordCapability() {
  return {
    configured: isDiscordConfigured(),
    inviteUrl: buildDiscordInviteUrl(),
  };
}

export async function listDiscordTargets() {
  ensureConfigured();
  await getDiscordClient();
  const guilds = await listBotGuilds();
  return { guilds, inviteUrl: buildDiscordInviteUrl() };
}

export async function listDiscordChannels(guildId: string) {
  ensureConfigured();
  await getDiscordClient();
  const channels = await listGuildVoiceChannels(guildId);
  return { channels };
}

export async function attachDiscordSink(opts: { sessionId: string; userId: string; guildId: string; channelId: string }) {
  ensureConfigured();
  ensureVoiceLostWiring();
  ensureIdleSweep();
  const client = await getDiscordClient();
  if (!client) throw new DiscordSinkError("Discord bot failed to start", 503);

  const existing = await getActiveDiscordSink(opts.sessionId);
  if (existing) {
    throw new DiscordSinkError("Discord is already attached to this session — detach first", 409);
  }

  const channel = await resolveVoiceChannel(opts.guildId, opts.channelId);
  const config: DiscordSinkConfig = {
    guildId: opts.guildId,
    channelId: opts.channelId,
    guildName: channel.guild.name,
    channelName: channel.name,
  };

  const [sink] = await db
    .insert(schema.sessionSinks)
    .values({
      sessionId: opts.sessionId,
      type: "discord",
      status: "pending",
      externalGuildId: opts.guildId,
      externalChannelId: opts.channelId,
      configJson: JSON.stringify(config),
      attachedByUserId: opts.userId,
    })
    .returning();

  if (!sink) throw new DiscordSinkError("Failed to create sink row", 500);

  try {
    await ensureVoiceJoined(opts.sessionId, channel);
    await db.update(schema.sessionSinks).set({ status: "active", errorMessage: null }).where(eq(schema.sessionSinks.id, sink.id));

    ensureSubscription(opts.sessionId);

    // Apply current session state immediately
    const { buildSessionSnapshot } = await import("$lib/server/sessions/snapshot");
    const snapshot = await buildSessionSnapshot(opts.sessionId);
    if (snapshot) await syncSnapshotToVoice(opts.sessionId, snapshot);

    await logConnectionActivity({
      userId: opts.userId,
      provider: "discord",
      kind: "attach",
      summary: `Joined ${config.channelName ?? config.channelId} in ${config.guildName ?? config.guildId}`,
      meta: { sessionId: opts.sessionId, guildId: config.guildId, channelId: config.channelId },
    });

    return { ...(await getActiveDiscordSink(opts.sessionId))!, config };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to join voice";
    await db
      .update(schema.sessionSinks)
      .set({ status: "error", errorMessage: message, detachedAt: new Date() })
      .where(eq(schema.sessionSinks.id, sink.id));
    await leaveVoice(opts.sessionId);
    throw new DiscordSinkError(message, 502);
  }
}

/**
 * Re-join the bot to the session's selected Discord channel after kick / idle /
 * network drop. Keeps the existing sink row (channel selection).
 */
export async function reconnectDiscordSink(sessionId: string) {
  ensureConfigured();
  ensureVoiceLostWiring();
  ensureIdleSweep();

  const sink = await getActiveDiscordSink(sessionId);
  if (!sink) throw new DiscordSinkError("No Discord sink attached — attach a channel first", 404);

  const config = parseDiscordSinkConfig(sink.configJson);
  const guildId = config?.guildId ?? sink.externalGuildId;
  const channelId = config?.channelId ?? sink.externalChannelId;
  if (!guildId || !channelId) {
    throw new DiscordSinkError("Discord sink is missing guild/channel — detach and attach again", 400);
  }

  const client = await getDiscordClient();
  if (!client) throw new DiscordSinkError("Discord bot failed to start", 503);

  await db
    .update(schema.sessionSinks)
    .set({ status: "pending", errorMessage: null })
    .where(eq(schema.sessionSinks.id, sink.id));

  try {
    const channel = await resolveVoiceChannel(guildId, channelId);
    const nextConfig: DiscordSinkConfig = {
      guildId,
      channelId,
      guildName: channel.guild.name,
      channelName: channel.name,
    };
    await ensureVoiceJoined(sessionId, channel);
    await db
      .update(schema.sessionSinks)
      .set({
        status: "active",
        errorMessage: null,
        externalGuildId: guildId,
        externalChannelId: channelId,
        configJson: JSON.stringify(nextConfig),
      })
      .where(eq(schema.sessionSinks.id, sink.id));

    ensureSubscription(sessionId);

    const { buildSessionSnapshot } = await import("$lib/server/sessions/snapshot");
    const snapshot = await buildSessionSnapshot(sessionId);
    if (snapshot) await syncSnapshotToVoice(sessionId, snapshot);

    if (sink.attachedByUserId) {
      await logConnectionActivity({
        userId: sink.attachedByUserId,
        provider: "discord",
        kind: "reconnect",
        summary: `Reconnected to ${nextConfig.channelName ?? nextConfig.channelId} in ${nextConfig.guildName ?? nextConfig.guildId}`,
        meta: { sessionId, guildId: nextConfig.guildId, channelId: nextConfig.channelId },
      });
    }

    return (await getActiveDiscordSink(sessionId))!;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reconnect voice";
    await markSinkError(sink.id, message);
    await leaveVoice(sessionId);
    throw new DiscordSinkError(message, 502);
  }
}

export async function detachDiscordSink(sessionId: string, opts?: { reason?: string }) {
  const sink = await getActiveDiscordSink(sessionId);
  await leaveVoice(sessionId);
  if (!sink) return null;

  const [updated] = await db
    .update(schema.sessionSinks)
    .set({
      status: "detached",
      detachedAt: new Date(),
      errorMessage: opts?.reason ?? null,
    })
    .where(eq(schema.sessionSinks.id, sink.id))
    .returning();

  return updated ?? null;
}

/**
 * Leave voice but keep the sink row so the host can Reconnect to the same channel.
 * Used for session stale / idle timeout / soft disconnects.
 */
export async function disconnectDiscordVoice(sessionId: string, reason = "Disconnected from voice") {
  await leaveVoice(sessionId);
  const sink = await getActiveDiscordSink(sessionId);
  if (!sink) return null;
  await db
    .update(schema.sessionSinks)
    .set({ status: "error", errorMessage: reason })
    .where(eq(schema.sessionSinks.id, sink.id));
  return sink;
}

export function serializeDiscordSink(row: typeof schema.sessionSinks.$inferSelect | null | undefined) {
  if (!row) return null;
  const config = parseDiscordSinkConfig(row.configJson);
  const voiceConnected = isVoiceConnected(row.sessionId);
  return {
    id: row.id,
    status: row.status,
    guildId: row.externalGuildId,
    channelId: row.externalChannelId,
    guildName: config?.guildName ?? null,
    channelName: config?.channelName ?? null,
    errorMessage: row.errorMessage,
    attachedAt: row.createdAt.toISOString(),
    /** Bot currently joined in this process to the selected channel. */
    voiceConnected,
  };
}

/**
 * Sweep in-memory voice runtimes: leave when the session is idle/stale/ended.
 * Timeout = `DISCORD_VOICE_IDLE_MS` (same as `SESSION_IDLE_MS`, 15 minutes).
 */
export async function disconnectIdleDiscordVoices(now: Date = new Date()): Promise<number> {
  let changed = 0;
  for (const sessionId of listVoiceSessionIds()) {
    const session = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, sessionId) });
    if (!session || session.status !== "live" || session.endedAt || session.staleAt) {
      await disconnectDiscordVoice(sessionId, session?.staleAt ? "Session went idle" : "Session ended");
      changed += 1;
      continue;
    }
    if (
      isLiveSessionIdle({
        lastActivityAt: session.lastActivityAt,
        playbackState: session.playbackState,
        now,
        idleMs: DISCORD_VOICE_IDLE_MS,
      })
    ) {
      await disconnectDiscordVoice(sessionId, `Idle for ${Math.round(DISCORD_VOICE_IDLE_MS / 60_000)} minutes`);
      changed += 1;
    }
  }
  return changed;
}

/** Called when a perpetual session goes stale — leave voice, keep channel selection. */
export async function onSessionStale(sessionId: string) {
  try {
    await disconnectDiscordVoice(sessionId, "Session went idle");
  } catch (err) {
    console.warn("[zap discord] disconnect on stale failed", err);
  }
}

/** Called when a session ends — best-effort leave + detach sink. */
export async function onSessionEnded(sessionId: string) {
  try {
    await detachDiscordSink(sessionId, { reason: "session_ended" });
  } catch (err) {
    console.warn("[zap discord] detach on end failed", err);
  }
}
