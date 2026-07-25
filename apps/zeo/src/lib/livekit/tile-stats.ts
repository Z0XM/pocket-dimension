import { Track, type LocalParticipant, type Participant, type RemoteParticipant, type Room } from "livekit-client";
import { readSignalRttMs } from "./connection-stats";

export type TileMediaStats = {
  pingMs: number | null;
  videoQuality: string | null;
  audioKbps: number | null;
  fps: number | null;
};

export const EMPTY_TILE_STATS: TileMediaStats = {
  pingMs: null,
  videoQuality: null,
  audioKbps: null,
  fps: null,
};

export type TileStatsTarget = {
  key: string;
  kind: "participant" | "screen-share";
  identity: string;
};

function formatVideoQuality(width?: number, height?: number): string | null {
  if (!height || height <= 0) return null;
  const standard = [360, 480, 720, 1080].find((value) => Math.abs(height - value) <= 8);
  if (standard) return `${standard}p`;
  if (width && width > 0) return `${width}×${height}`;
  return `${height}p`;
}

function bitrateToKbps(bitsPerSecond?: number): number | null {
  if (typeof bitsPerSecond !== "number" || !Number.isFinite(bitsPerSecond) || bitsPerSecond <= 0) {
    return null;
  }
  return Math.max(1, Math.round(bitsPerSecond / 1000));
}

async function readTrackStats(participant: Participant, source: Track.Source): Promise<RTCStatsReport | null> {
  const publication = participant.getTrackPublication(source);
  const track = publication?.track as { getRTCStatsReport?: () => Promise<RTCStatsReport | undefined> } | undefined;
  if (!track?.getRTCStatsReport) return null;

  try {
    const report = await track.getRTCStatsReport();
    return report ?? null;
  } catch {
    return null;
  }
}

type Direction = "inbound" | "outbound";

function extractVideoFields(report: RTCStatsReport | null, direction: Direction) {
  let width: number | undefined;
  let height: number | undefined;
  let fps: number | undefined;
  let rttMs: number | undefined;

  if (!report) return { width, height, fps, rttMs };

  for (const stat of report.values()) {
    if (stat.type === "candidate-pair" && stat.state === "succeeded" && typeof stat.currentRoundTripTime === "number") {
      rttMs = Math.round(stat.currentRoundTripTime * 1000);
    }

    const match =
      direction === "inbound"
        ? stat.type === "inbound-rtp" && stat.kind === "video"
        : stat.type === "outbound-rtp" && stat.kind === "video";
    if (!match) continue;

    if (typeof stat.frameWidth === "number") width = stat.frameWidth;
    if (typeof stat.frameHeight === "number") height = stat.frameHeight;
    if (typeof stat.framesPerSecond === "number") fps = Math.round(stat.framesPerSecond);
  }

  return { width, height, fps, rttMs };
}

const previousByteSamples = new Map<string, { at: number; bytes: number }>();

function kbpsFromBytes(sampleKey: string, bytes: number | undefined, now: number): number | null {
  if (typeof bytes !== "number" || !Number.isFinite(bytes)) return null;
  const previous = previousByteSamples.get(sampleKey);
  previousByteSamples.set(sampleKey, { at: now, bytes });
  if (!previous || now <= previous.at) return null;
  const elapsedSec = (now - previous.at) / 1000;
  if (elapsedSec <= 0) return null;
  const deltaBytes = Math.max(0, bytes - previous.bytes);
  return Math.max(1, Math.round((deltaBytes * 8) / elapsedSec / 1000));
}

function extractAudioKbps(report: RTCStatsReport | null, direction: Direction, sampleKey: string): number | null {
  if (!report) return null;
  const now = Date.now();

  for (const stat of report.values()) {
    const match =
      direction === "inbound"
        ? stat.type === "inbound-rtp" && stat.kind === "audio"
        : stat.type === "outbound-rtp" && stat.kind === "audio";
    if (!match) continue;

    const bitrate = (stat as { bitrate?: number }).bitrate;
    const fromBitrate = bitrateToKbps(bitrate);
    if (fromBitrate != null) return fromBitrate;

    const bytes = direction === "outbound" ? stat.bytesSent : stat.bytesReceived;
    return kbpsFromBytes(sampleKey, typeof bytes === "number" ? bytes : undefined, now);
  }

  return null;
}

async function statsForParticipant(
  participant: LocalParticipant | RemoteParticipant,
  kind: "participant" | "screen-share",
  roomPingMs: number | null
): Promise<TileMediaStats> {
  const direction: Direction = participant.isLocal ? "outbound" : "inbound";
  const videoSource = kind === "screen-share" ? Track.Source.ScreenShare : Track.Source.Camera;
  const audioSource = kind === "screen-share" ? Track.Source.ScreenShareAudio : Track.Source.Microphone;

  const [videoReport, audioReport] = await Promise.all([readTrackStats(participant, videoSource), readTrackStats(participant, audioSource)]);
  const video = extractVideoFields(videoReport, direction);
  const audioKbps = extractAudioKbps(audioReport, direction, `${participant.identity}:${kind}:audio`);

  return {
    pingMs: video.rttMs ?? roomPingMs,
    videoQuality: formatVideoQuality(video.width, video.height),
    audioKbps,
    fps: video.fps ?? null,
  };
}

export async function collectTileStats(room: Room, tiles: ReadonlyArray<TileStatsTarget>): Promise<Record<string, TileMediaStats>> {
  const roomPingMs = readSignalRttMs(room);
  const result: Record<string, TileMediaStats> = {};

  await Promise.all(
    tiles.map(async (tile) => {
      const participant =
        tile.identity === room.localParticipant.identity ? room.localParticipant : room.remoteParticipants.get(tile.identity);
      if (!participant) {
        result[tile.key] = { ...EMPTY_TILE_STATS, pingMs: roomPingMs };
        return;
      }
      result[tile.key] = await statsForParticipant(participant, tile.kind, roomPingMs);
    })
  );

  return result;
}
