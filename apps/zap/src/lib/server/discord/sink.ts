import { db, schema } from "@pocket-dimension/db";
import { and, eq, isNull } from "drizzle-orm";
import { sessionEventBus } from "$lib/server/sessions/event-bus";
import type { SessionSnapshot } from "$lib/server/sessions/types";
import { getDiscordClient, listBotGuilds, listGuildVoiceChannels, resolveVoiceChannel } from "./bot";
import { buildDiscordInviteUrl, isDiscordConfigured, parseDiscordSinkConfig, type DiscordSinkConfig } from "./config";
import { playbackCommandFromSnapshot } from "./sync";
import { applyPlaybackCommand, ensureVoiceJoined, leaveVoice } from "./voice";

const subscribedSessions = new Set<string>();

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

async function syncSnapshotToVoice(sessionId: string, snapshot: SessionSnapshot) {
  const sink = await getActiveDiscordSink(sessionId);
  if (!sink) return;
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

export function serializeDiscordSink(row: typeof schema.sessionSinks.$inferSelect | null | undefined) {
  if (!row) return null;
  const config = parseDiscordSinkConfig(row.configJson);
  return {
    id: row.id,
    status: row.status,
    guildId: row.externalGuildId,
    channelId: row.externalChannelId,
    guildName: config?.guildName ?? null,
    channelName: config?.channelName ?? null,
    errorMessage: row.errorMessage,
    attachedAt: row.createdAt.toISOString(),
  };
}

/** Called when a session ends — best-effort leave. */
export async function onSessionEnded(sessionId: string) {
  try {
    await detachDiscordSink(sessionId, { reason: "session_ended" });
  } catch (err) {
    console.warn("[zap discord] detach on end failed", err);
  }
}
