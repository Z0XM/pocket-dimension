import { AccessToken } from "livekit-server-sdk";
import { env, TOKEN_TTL_SECONDS } from "./env";

export type ClientIceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

/** Explicit TURN for external coturn. LiveKit embedded TURN needs no client override. */
export function clientIceServers(): ClientIceServer[] | undefined {
  const { LIVEKIT_TURN_HOST, LIVEKIT_TURN_USERNAME, LIVEKIT_TURN_CREDENTIAL, LIVEKIT_TURN_TLS } = env;
  if (!LIVEKIT_TURN_HOST || !LIVEKIT_TURN_USERNAME || !LIVEKIT_TURN_CREDENTIAL) {
    return undefined;
  }

  const urls = LIVEKIT_TURN_TLS
    ? [`turns:${LIVEKIT_TURN_HOST}:5349?transport=tcp`, `turn:${LIVEKIT_TURN_HOST}:3478?transport=udp`]
    : [`turn:${LIVEKIT_TURN_HOST}:3478?transport=udp`, `turn:${LIVEKIT_TURN_HOST}:3478?transport=tcp`];

  return [{ urls, username: LIVEKIT_TURN_USERNAME, credential: LIVEKIT_TURN_CREDENTIAL }];
}

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

export async function mintListeningBotToken(options: { livekitRoomName: string; identity: string }) {
  const token = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: options.identity,
    name: "Listening",
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
