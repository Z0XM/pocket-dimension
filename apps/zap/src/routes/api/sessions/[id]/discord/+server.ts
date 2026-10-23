import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  DiscordSinkError,
  attachDiscordSink,
  detachDiscordSink,
  describeDiscordCapability,
  getActiveDiscordSink,
  reconnectDiscordSink,
  serializeDiscordSink,
} from "$lib/server/discord";
import { SessionError, getSessionForUser } from "$lib/server/sessions";

async function requireSetup(sessionId: string, userId: string) {
  const snapshot = await getSessionForUser(sessionId, userId);
  if (!snapshot.me?.canSetup) {
    throw error(403, "Only setup-capable members can manage Discord sink");
  }
  return snapshot;
}

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.user) throw error(401, "Sign in required");
  try {
    await getSessionForUser(params.id!, locals.user.id);
    const sink = await getActiveDiscordSink(params.id!);
    const capability = await describeDiscordCapability();
    return json({ sink: serializeDiscordSink(sink), ...capability });
  } catch (err) {
    if (err instanceof SessionError) throw error(err.status, err.message);
    throw err;
  }
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.user) throw error(401, "Sign in required");
  if (!locals.user.emailVerified) throw error(403, "Verify email first");

  try {
    await requireSetup(params.id!, locals.user.id);
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      guildId?: string;
      channelId?: string;
    };

    if (body.action === "reconnect") {
      const reconnected = await reconnectDiscordSink(params.id!);
      return json({ sink: serializeDiscordSink(reconnected) });
    }

    if (!body.guildId?.trim() || !body.channelId?.trim()) {
      throw error(400, "guildId and channelId required (or action: reconnect)");
    }
    const attached = await attachDiscordSink({
      sessionId: params.id!,
      userId: locals.user.id,
      guildId: body.guildId.trim(),
      channelId: body.channelId.trim(),
    });
    return json({ sink: serializeDiscordSink(attached) }, { status: 201 });
  } catch (err) {
    if (err instanceof DiscordSinkError) throw error(err.status, err.message);
    if (err instanceof SessionError) throw error(err.status, err.message);
    throw err;
  }
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  if (!locals.user) throw error(401, "Sign in required");
  try {
    await requireSetup(params.id!, locals.user.id);
    const detached = await detachDiscordSink(params.id!);
    return json({ sink: serializeDiscordSink(detached), ok: true });
  } catch (err) {
    if (err instanceof DiscordSinkError) throw error(err.status, err.message);
    if (err instanceof SessionError) throw error(err.status, err.message);
    throw err;
  }
};
