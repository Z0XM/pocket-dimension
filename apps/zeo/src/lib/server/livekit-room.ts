import { RoomServiceClient } from "livekit-server-sdk";
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
