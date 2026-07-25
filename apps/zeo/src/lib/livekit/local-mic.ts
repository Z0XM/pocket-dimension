import { Track, type LocalAudioTrack, type Room } from "livekit-client";
import { attachMicGateProcessor } from "./room-client";
import type { MicGateProcessor } from "./mic-gate-processor";

function getLocalMicTrack(room: Room): LocalAudioTrack | undefined {
  const track = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
  if (!track || track.kind !== Track.Kind.Audio) return undefined;
  return track as LocalAudioTrack;
}

/** Detach mic-gate (if any) then mute so unmute can reacquire a clean raw track. */
export async function disableLocalMicrophone(room: Room) {
  const track = getLocalMicTrack(room);
  if (track) {
    try {
      await track.stopProcessor();
    } catch {
      // Processor may already be absent.
    }
  }

  await room.localParticipant.setMicrophoneEnabled(false);
}

/**
 * Unmute/publish the microphone and attach a freshly created mic-gate processor.
 * Returns the processor when attached, or null when the gate could not be applied
 * (raw mic remains enabled).
 */
export async function enableLocalMicrophoneWithGate(
  room: Room,
  options: {
    deviceId?: string;
    createProcessor: () => MicGateProcessor;
    onGateFallback?: () => void;
  }
): Promise<MicGateProcessor | null> {
  await room.localParticipant.setMicrophoneEnabled(true, {
    deviceId: options.deviceId,
  });

  const track = getLocalMicTrack(room);
  if (!track) {
    return null;
  }

  // If mute/device loss ended the capture track, force a reacquire before gating.
  if (track.mediaStreamTrack.readyState === "ended") {
    await track.restartTrack(options.deviceId ? { deviceId: options.deviceId } : undefined);
  }

  const processor = options.createProcessor();
  try {
    await attachMicGateProcessor(room, processor);
    return processor;
  } catch {
    try {
      await track.stopProcessor();
    } catch {
      // Keep the raw microphone track if processor teardown fails.
    }
    options.onGateFallback?.();
    return null;
  }
}
