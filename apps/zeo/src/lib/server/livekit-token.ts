import { AccessToken } from "livekit-server-sdk";
import { env, TOKEN_TTL_SECONDS } from "./env";

export async function mintRoomJoinToken(options: { livekitRoomName: string; identity: string; name: string }) {
  const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: options.identity,
    name: options.name,
    ttl: TOKEN_TTL_SECONDS,
  });

  token.addGrant({
    roomJoin: true,
    room: options.livekitRoomName,
    canPublish: true,
    canSubscribe: true,
  });

  return token.toJwt();
}

export function publicLiveKitWsUrl() {
  return env.PUBLIC_LIVEKIT_URL;
}
