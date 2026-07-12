import { Room, Track, type RemoteAudioTrack, type RemoteTrack } from "livekit-client";
import { logAudioDiag } from "./call-audio-diagnostics";

const attachedElements = new WeakMap<RemoteTrack, HTMLAudioElement>();

function isRemoteAudioTrack(track: RemoteTrack): track is RemoteAudioTrack {
  return track.kind === Track.Kind.Audio;
}

export function attachRemoteAudioTrack(track: RemoteTrack) {
  if (!isRemoteAudioTrack(track)) {
    logAudioDiag("warn", "remote_audio.attach_skipped", { reason: "not_audio", kind: track.kind });
    return;
  }

  if (attachedElements.has(track)) {
    logAudioDiag("info", "remote_audio.attach_skipped", { reason: "already_attached", trackSid: track.sid });
    return;
  }

  const element = track.attach();
  element.hidden = true;
  element.autoplay = true;
  document.body.appendChild(element);
  attachedElements.set(track, element);

  logAudioDiag("info", "remote_audio.attached", {
    trackSid: track.sid,
    source: track.source,
    elementPaused: element.paused,
    elementMuted: element.muted,
    elementVolume: element.volume,
  });
}

export function detachRemoteAudioTrack(track: RemoteTrack) {
  const element = attachedElements.get(track);
  if (!element) return;

  track.detach(element);
  element.remove();
  attachedElements.delete(track);

  logAudioDiag("info", "remote_audio.detached", { trackSid: track.sid, source: track.source });
}

export function attachAllRemoteAudioTracks(room: Room) {
  let attached = 0;
  let skipped = 0;

  for (const participant of room.remoteParticipants.values()) {
    for (const publication of participant.audioTrackPublications.values()) {
      const track = publication.track;
      if (track && publication.isSubscribed !== false) {
        const before = attachedElements.has(track);
        attachRemoteAudioTrack(track);
        if (!before && attachedElements.has(track)) {
          attached += 1;
        } else {
          skipped += 1;
        }
      }
    }
  }

  logAudioDiag("info", "remote_audio.attach_all", { attached, skipped });
}

export function detachAllRemoteAudioTracks(room: Room) {
  for (const participant of room.remoteParticipants.values()) {
    for (const publication of participant.audioTrackPublications.values()) {
      const track = publication.track;
      if (track) {
        detachRemoteAudioTrack(track);
      }
    }
  }
}
