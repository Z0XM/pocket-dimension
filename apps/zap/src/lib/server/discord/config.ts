/** Connect (1<<20) + Speak (1<<21) + View Channel (1<<10) */
export const DISCORD_BOT_PERMISSIONS = String((1 << 20) | (1 << 21) | (1 << 10));

export function isDiscordConfigured() {
  return Boolean(Bun.env.DISCORD_BOT_TOKEN?.trim() && (Bun.env.DISCORD_CLIENT_ID?.trim() || Bun.env.DISCORD_APPLICATION_ID?.trim()));
}

export function discordBotToken() {
  return Bun.env.DISCORD_BOT_TOKEN?.trim() || null;
}

export function discordClientId() {
  return Bun.env.DISCORD_CLIENT_ID?.trim() || Bun.env.DISCORD_APPLICATION_ID?.trim() || null;
}

/** Bot invite URL for the shared PD Discord application. */
export function buildDiscordInviteUrl(clientId = discordClientId()) {
  if (!clientId) return null;
  const url = new URL("https://discord.com/api/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("permissions", DISCORD_BOT_PERMISSIONS);
  url.searchParams.set("scope", "bot");
  return url.toString();
}

export type DiscordSinkConfig = {
  guildId: string;
  channelId: string;
  guildName?: string;
  channelName?: string;
};

export function parseDiscordSinkConfig(raw: string | null | undefined): DiscordSinkConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DiscordSinkConfig>;
    if (!parsed.guildId || !parsed.channelId) return null;
    return {
      guildId: String(parsed.guildId),
      channelId: String(parsed.channelId),
      guildName: parsed.guildName ? String(parsed.guildName) : undefined,
      channelName: parsed.channelName ? String(parsed.channelName) : undefined,
    };
  } catch {
    return null;
  }
}
