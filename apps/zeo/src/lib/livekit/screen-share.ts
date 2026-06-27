import { Track, type LocalParticipant, type RemoteParticipant, type Room } from "livekit-client";
import { listRoomParticipants } from "./room-client";

export function isScreenShareActive(participant: LocalParticipant | RemoteParticipant) {
  const publication = participant.getTrackPublication(Track.Source.ScreenShare);
  return Boolean(publication?.track && !publication.isMuted);
}

export function findScreenShareParticipant(room: Room, excludeIdentity?: string) {
  for (const participant of listRoomParticipants(room)) {
    if (excludeIdentity && participant.identity === excludeIdentity) continue;
    if (isScreenShareActive(participant)) return participant;
  }
  return null;
}

export function displayNameForParticipant(participant: LocalParticipant | RemoteParticipant, localIdentity: string, localDisplayName: string) {
  if (participant.identity === localIdentity) return localDisplayName;
  return participant.name || "Participant";
}
