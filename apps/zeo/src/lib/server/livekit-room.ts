import { RoomServiceClient, TrackSource } from "livekit-server-sdk";
import { env } from "./env";

function liveKitHttpHost() {
  return env.LIVEKIT_URL.replace(/^ws:\/\//, "http://").replace(/^wss:\/\//, "https://");
}

let client: RoomServiceClient | null = null;

function getClient() {
  if (!client) {
    client = new RoomServiceClient(liveKitHttpHost(), env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
  }
  return client;
}

const TRACK_SOURCE_BY_KIND = {
  microphone: TrackSource.MICROPHONE,
  camera: TrackSource.CAMERA,
} as const;

export async function deleteLiveKitRoom(livekitRoomName: string) {
  await getClient().deleteRoom(livekitRoomName);
}

export async function removeLiveKitParticipant(livekitRoomName: string, identity: string) {
  await getClient().removeParticipant(livekitRoomName, identity);
}

export async function countLiveKitParticipants(livekitRoomName: string) {
  const participants = await getClient().listParticipants(livekitRoomName);
  return participants.length;
}

export async function listLiveKitParticipants(livekitRoomName: string) {
  return getClient().listParticipants(livekitRoomName);
}

export async function muteParticipantPublishedTrack(livekitRoomName: string, identity: string, track: keyof typeof TRACK_SOURCE_BY_KIND) {
  const source = TRACK_SOURCE_BY_KIND[track];
  const participants = await listLiveKitParticipants(livekitRoomName);
  const participant = participants.find((entry) => entry.identity === identity);
  if (!participant) return false;

  let muted = false;
  for (const published of participant.tracks ?? []) {
    if (published.source === source && published.sid) {
      await getClient().mutePublishedTrack(livekitRoomName, identity, published.sid, true);
      muted = true;
    }
  }

  return muted;
}

export async function stopActiveScreenShares(livekitRoomName: string) {
  const participants = await listLiveKitParticipants(livekitRoomName);

  for (const participant of participants) {
    for (const track of participant.tracks ?? []) {
      if (track.source === TrackSource.SCREEN_SHARE && track.sid) {
        await getClient().mutePublishedTrack(livekitRoomName, participant.identity, track.sid, true);
      }
    }
  }
}
