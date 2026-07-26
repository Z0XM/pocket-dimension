export const LISTENING_BOT_PREFIX = "listening-bot:";

export function isListeningBotIdentity(identity: string) {
  return identity.startsWith(LISTENING_BOT_PREFIX);
}
