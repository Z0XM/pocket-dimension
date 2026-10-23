import { db, schema } from "@pocket-dimension/db";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { describeDiscordCapability, getActiveDiscordSink, serializeDiscordSink } from "$lib/server/discord";
import { parseDiscordSinkConfig } from "$lib/server/discord/config";
import { isVoiceConnected } from "$lib/server/discord/voice";
import { listConnectionActivity } from "./activity";

/** Discord connection page: bot capability + recent sink activity for this user. */
export async function getDiscordConnectionPage(userId: string) {
  const capability = await describeDiscordCapability();

  const sinks = await db.query.sessionSinks.findMany({
    where: and(eq(schema.sessionSinks.type, "discord"), or(eq(schema.sessionSinks.attachedByUserId, userId))),
    orderBy: [desc(schema.sessionSinks.createdAt)],
    limit: 30,
  });

  // Also include sinks on sessions this user hosts (even if attachedBy differs).
  const hosted = await db.query.sessions.findMany({
    where: eq(schema.sessions.hostUserId, userId),
    columns: { id: true },
    limit: 50,
  });
  const hostedIds = new Set(hosted.map((s) => s.id));
  const extra =
    hostedIds.size === 0
      ? []
      : await db.query.sessionSinks.findMany({
          where: and(eq(schema.sessionSinks.type, "discord")),
          orderBy: [desc(schema.sessionSinks.createdAt)],
          limit: 40,
        });

  const byId = new Map<string, (typeof sinks)[number]>();
  for (const s of [...sinks, ...extra.filter((s) => hostedIds.has(s.sessionId))]) {
    byId.set(s.id, s);
  }

  const sinkActivity = [...byId.values()]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 25)
    .map((row) => {
      const config = parseDiscordSinkConfig(row.configJson);
      return {
        id: `sink:${row.id}`,
        kind: row.detachedAt ? "detached" : row.status,
        summary: row.detachedAt
          ? `Left ${config?.channelName ?? row.externalChannelId ?? "voice"} in ${config?.guildName ?? row.externalGuildId ?? "server"}`
          : `Attached to ${config?.channelName ?? row.externalChannelId ?? "voice"} in ${config?.guildName ?? row.externalGuildId ?? "server"}`,
        meta: {
          sessionId: row.sessionId,
          guildId: row.externalGuildId,
          channelId: row.externalChannelId,
          guildName: config?.guildName ?? null,
          channelName: config?.channelName ?? null,
          status: row.status,
          errorMessage: row.errorMessage,
          voiceConnected: isVoiceConnected(row.sessionId) && !row.detachedAt,
        },
        at: (row.detachedAt ?? row.createdAt).toISOString(),
      };
    });

  const logged = await listConnectionActivity({ userId, provider: "discord", limit: 40 });

  // Merge log + sink-derived, newest first, dedupe by id.
  const merged = [...logged, ...sinkActivity].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const seen = new Set<string>();
  const activity = [];
  for (const entry of merged) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    activity.push(entry);
    if (activity.length >= 40) break;
  }

  // Live sinks across hosted sessions (for status strip).
  const live: Array<{ sessionId: string; sink: ReturnType<typeof serializeDiscordSink>; voiceConnected: boolean }> = [];
  for (const sessionId of hostedIds) {
    const sink = await getActiveDiscordSink(sessionId);
    if (!sink) continue;
    live.push({
      sessionId,
      sink: serializeDiscordSink(sink),
      voiceConnected: isVoiceConnected(sessionId),
    });
  }

  return {
    configured: capability.configured,
    inviteUrl: capability.inviteUrl,
    live,
    activity,
  };
}

export async function countActiveDiscordSinksForUser(userId: string) {
  const hosted = await db.query.sessions.findMany({
    where: and(eq(schema.sessions.hostUserId, userId), eq(schema.sessions.status, "live"), isNull(schema.sessions.staleAt)),
    columns: { id: true },
  });
  let n = 0;
  for (const s of hosted) {
    if (await getActiveDiscordSink(s.id)) n += 1;
  }
  return n;
}
