import { spawn } from "node:child_process";
import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  type AudioPlayer,
  type VoiceConnection,
} from "@discordjs/voice";
import type { VoiceBasedChannel } from "discord.js";
import { getPresignedGetUrl } from "$lib/server/storage";
import { db, schema } from "@pocket-dimension/db";
import { eq } from "drizzle-orm";
import { ensureOpusRuntime } from "./opus-runtime";
import type { DiscordPlaybackCommand } from "./sync";
import { shouldResync } from "./sync";

// Prefer opusscript before any prism-media encoder path can probe @discordjs/opus.
ensureOpusRuntime();

type SessionVoiceRuntime = {
  connection: VoiceConnection;
  player: AudioPlayer;
  guildId: string;
  channelId: string;
  appliedGeneration: number | null;
  appliedAssetId: string | null;
  ffmpeg: ReturnType<typeof spawn> | null;
};

const runtimes = new Map<string, SessionVoiceRuntime>();

async function audioUrlForAsset(mediaAssetId: string): Promise<string> {
  const asset = await db.query.mediaAssets.findFirst({
    where: eq(schema.mediaAssets.id, mediaAssetId),
  });
  if (!asset?.storageKey || asset.status !== "ready") {
    throw new Error("Track not playable for Discord sink");
  }
  if (asset.storageKey === "fixture:local") {
    const origin = (Bun.env.ORIGIN || Bun.env.PUBLIC_ZAP_ORIGIN || "http://localhost:3013").replace(/\/$/, "");
    return `${origin}/api/media/${mediaAssetId}/audio`;
  }
  return getPresignedGetUrl(asset.storageKey, 3600);
}

function killFfmpeg(runtime: SessionVoiceRuntime) {
  if (runtime.ffmpeg && !runtime.ffmpeg.killed) {
    runtime.ffmpeg.kill("SIGKILL");
  }
  runtime.ffmpeg = null;
}

/**
 * Encode to Ogg Opus in ffmpeg so @discordjs/voice can demux without a native
 * opus addon (@discordjs/opus / opusscript). Raw PCM + inlineVolume forces those.
 */
function startFfmpegResource(url: string, positionMs: number) {
  const seekSec = Math.max(0, positionMs / 1000);
  const args = [
    "-reconnect",
    "1",
    "-reconnect_streamed",
    "1",
    "-reconnect_delay_max",
    "5",
    ...(seekSec > 0.25 ? ["-ss", String(seekSec)] : []),
    "-i",
    url,
    "-analyzeduration",
    "0",
    "-loglevel",
    "error",
    "-acodec",
    "libopus",
    "-application",
    "audio",
    "-frame_duration",
    "20",
    "-f",
    "ogg",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-b:a",
    "96k",
    "pipe:1",
  ];
  const ffmpeg = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
  ffmpeg.stderr?.on("data", (chunk) => {
    const text = String(chunk);
    if (text.trim()) console.warn("[zap discord ffmpeg]", text.trim());
  });
  const resource = createAudioResource(ffmpeg.stdout!, {
    inputType: StreamType.OggOpus,
  });
  return { ffmpeg, resource };
}

/** Guide pattern: real disconnect vs channel-move reconnect. */
function wireConnectionLifecycle(sessionId: string, connection: VoiceConnection) {
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
      // Reconnecting / moving channels — keep runtime
    } catch {
      console.warn(`[zap discord] voice disconnected for session ${sessionId}; destroying connection`);
      try {
        connection.destroy();
      } catch {
        // already destroyed
      }
      const runtime = runtimes.get(sessionId);
      if (runtime?.connection === connection) {
        killFfmpeg(runtime);
        runtimes.delete(sessionId);
      }
    }
  });
}

export async function ensureVoiceJoined(sessionId: string, channel: VoiceBasedChannel) {
  const existing = runtimes.get(sessionId);
  if (existing && existing.channelId === channel.id && existing.connection.state.status !== VoiceConnectionStatus.Destroyed) {
    return existing;
  }
  if (existing) {
    await leaveVoice(sessionId);
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false,
  });

  wireConnectionLifecycle(sessionId, connection);

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
  } catch (err) {
    try {
      connection.destroy();
    } catch {
      // ignore
    }
    throw err instanceof Error ? err : new Error("Failed to enter voice Ready state");
  }

  const player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Play },
  });
  player.on("error", (err) => {
    console.error(`[zap discord] audio player error session=${sessionId}`, err.message);
  });
  connection.subscribe(player);

  const runtime: SessionVoiceRuntime = {
    connection,
    player,
    guildId: channel.guild.id,
    channelId: channel.id,
    appliedGeneration: null,
    appliedAssetId: null,
    ffmpeg: null,
  };
  runtimes.set(sessionId, runtime);
  return runtime;
}

export async function applyPlaybackCommand(sessionId: string, command: DiscordPlaybackCommand) {
  const runtime = runtimes.get(sessionId);
  if (!runtime) return;

  if (command.action === "idle") {
    killFfmpeg(runtime);
    runtime.player.stop(true);
    runtime.appliedGeneration = null;
    runtime.appliedAssetId = null;
    return;
  }

  if (command.action === "pause") {
    if (runtime.player.state.status === AudioPlayerStatus.Playing) {
      runtime.player.pause(true);
    }
    runtime.appliedGeneration = command.generation;
    return;
  }

  const needsHardResync = shouldResync(runtime.appliedGeneration, command.generation, runtime.appliedAssetId, command.mediaAssetId);

  if (!needsHardResync && runtime.player.state.status === AudioPlayerStatus.Paused) {
    runtime.player.unpause();
    runtime.appliedGeneration = command.generation;
    return;
  }

  if (!needsHardResync && runtime.player.state.status === AudioPlayerStatus.Playing) {
    runtime.appliedGeneration = command.generation;
    return;
  }

  killFfmpeg(runtime);
  const url = await audioUrlForAsset(command.mediaAssetId);
  const { ffmpeg, resource } = startFfmpegResource(url, command.positionMs);
  runtime.ffmpeg = ffmpeg;
  runtime.player.play(resource);
  try {
    await entersState(runtime.player, AudioPlayerStatus.Playing, 8_000);
  } catch (err) {
    console.warn(`[zap discord] player did not enter Playing in time session=${sessionId}`, err);
  }
  runtime.appliedGeneration = command.generation;
  runtime.appliedAssetId = command.mediaAssetId;
}

export async function leaveVoice(sessionId: string) {
  const runtime = runtimes.get(sessionId);
  if (!runtime) return;
  killFfmpeg(runtime);
  try {
    runtime.player.stop(true);
  } catch {
    // ignore
  }
  try {
    if (runtime.connection.state.status !== VoiceConnectionStatus.Destroyed) {
      runtime.connection.destroy();
    }
  } catch {
    // ignore
  }
  runtimes.delete(sessionId);
}

export function hasVoiceRuntime(sessionId: string) {
  return runtimes.has(sessionId);
}
