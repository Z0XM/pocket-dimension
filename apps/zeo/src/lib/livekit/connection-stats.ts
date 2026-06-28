import type { Room } from "livekit-client";
import { Track } from "livekit-client";

export function readSignalRttMs(room: Room): number | null {
  const rtt = room.engine?.client?.rtt;
  if (typeof rtt !== "number" || !Number.isFinite(rtt) || rtt <= 0) {
    return null;
  }
  return Math.round(rtt);
}

export async function readMediaRttMs(room: Room): Promise<number | null> {
  const micPublication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
  const track = micPublication?.track;

  if (!track || !("getRTCStatsReport" in track)) {
    return null;
  }

  try {
    const report = await track.getRTCStatsReport();
    if (!report) return null;

    for (const stat of report.values()) {
      if (stat.type === "candidate-pair" && stat.state === "succeeded" && "currentRoundTripTime" in stat) {
        const seconds = stat.currentRoundTripTime;
        if (typeof seconds === "number" && seconds > 0) {
          return Math.round(seconds * 1000);
        }
      }
    }
  } catch {
    return null;
  }

  return null;
}

export async function readConnectionRttMs(room: Room): Promise<number | null> {
  const signalRtt = readSignalRttMs(room);
  if (signalRtt !== null) {
    return signalRtt;
  }

  return readMediaRttMs(room);
}
