import { Room, Track, type RemoteAudioTrack, type RemoteTrack } from "livekit-client";
import { SYSTEM_DEFAULT_AUDIO_OUTPUT } from "./devices";

export { SYSTEM_DEFAULT_AUDIO_OUTPUT };

const attachedElements = new WeakMap<RemoteTrack, HTMLAudioElement>();
const attachedAudioElements = new Set<HTMLAudioElement>();

let activeAudioOutputDeviceId = SYSTEM_DEFAULT_AUDIO_OUTPUT;

function isRemoteAudioTrack(track: RemoteTrack): track is RemoteAudioTrack {
  return track.kind === Track.Kind.Audio;
}

export function normalizeAudioOutputDeviceId(deviceId?: string | null) {
  return deviceId?.trim() || SYSTEM_DEFAULT_AUDIO_OUTPUT;
}

export function getRemoteAudioOutputDeviceId() {
  return activeAudioOutputDeviceId;
}

async function applySinkId(element: HTMLMediaElement, deviceId: string) {
  if (!("setSinkId" in element)) return;

  const sinkId = normalizeAudioOutputDeviceId(deviceId);
  try {
    await element.setSinkId(sinkId);
    return;
  } catch {
    if (sinkId === SYSTEM_DEFAULT_AUDIO_OUTPUT) return;
  }

  try {
    await element.setSinkId(SYSTEM_DEFAULT_AUDIO_OUTPUT);
  } catch {
    // Fall back to the browser's current default route.
  }
}

export async function setRemoteAudioOutputDevice(deviceId?: string | null) {
  activeAudioOutputDeviceId = normalizeAudioOutputDeviceId(deviceId);
  await Promise.all([...attachedAudioElements].map((element) => applySinkId(element, activeAudioOutputDeviceId)));
}

export async function reapplyRoomAudioOutput(room: Room, deviceId?: string | null) {
  const sinkId = normalizeAudioOutputDeviceId(deviceId ?? room.getActiveDevice("audiooutput"));
  await setRemoteAudioOutputDevice(sinkId);

  try {
    await room.switchActiveDevice("audiooutput", sinkId);
    return;
  } catch {
    // Some browsers reject certain device ids — retry without exact matching.
  }

  try {
    await room.switchActiveDevice("audiooutput", sinkId, false);
  } catch {
    // Attached audio elements were still updated above.
  }
}

export function attachRemoteAudioTrack(track: RemoteTrack) {
  if (!isRemoteAudioTrack(track)) {
    return;
  }

  if (attachedElements.has(track)) {
    return;
  }

  const element = track.attach();
  element.hidden = true;
  element.autoplay = true;
  document.body.appendChild(element);
  attachedElements.set(track, element);
  attachedAudioElements.add(element);

  void applySinkId(element, activeAudioOutputDeviceId);
  void track.setSinkId(activeAudioOutputDeviceId).catch(() => undefined);
}

export function detachRemoteAudioTrack(track: RemoteTrack) {
  const element = attachedElements.get(track);
  if (!element) return;

  track.detach(element);
  element.remove();
  attachedElements.delete(track);
  attachedAudioElements.delete(element);
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
