import { Room, Track, type RemoteAudioTrack, type RemoteTrack } from "livekit-client";

const attachedElements = new WeakMap<RemoteTrack, HTMLAudioElement>();

function isRemoteAudioTrack(track: RemoteTrack): track is RemoteAudioTrack {
  return track.kind === Track.Kind.Audio;
}

export function attachRemoteAudioTrack(track: RemoteTrack) {
  if (!isRemoteAudioTrack(track) || attachedElements.has(track)) {
    return;
  }

  const element = track.attach();
  element.hidden = true;
  element.autoplay = true;
  document.body.appendChild(element);
  attachedElements.set(track, element);
}

export function detachRemoteAudioTrack(track: RemoteTrack) {
  const element = attachedElements.get(track);
  if (!element) return;

  track.detach(element);
  element.remove();
  attachedElements.delete(track);
}

export function attachAllRemoteAudioTracks(room: Room) {
  for (const participant of room.remoteParticipants.values()) {
    for (const publication of participant.audioTrackPublications.values()) {
      const track = publication.track;
      if (track && publication.isSubscribed !== false) {
        attachRemoteAudioTrack(track);
      }
    }
  }
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
