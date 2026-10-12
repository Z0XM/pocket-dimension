import { ChannelType, Client, Events, GatewayIntentBits, type Client as DiscordClient, type VoiceBasedChannel } from "discord.js";
import { discordBotToken, isDiscordConfigured } from "./config";

let clientPromise: Promise<DiscordClient> | null = null;

/**
 * Lazy singleton Discord gateway client (discord.js 14.27+).
 * Intents: Guilds (channel/guild cache) + GuildVoiceStates (voice adapter / join).
 * Readiness: wait for Events.ClientReady (not deprecated `ready`).
 */
export async function getDiscordClient(): Promise<DiscordClient | null> {
  if (!isDiscordConfigured()) return null;
  if (!clientPromise) {
    clientPromise = (async () => {
      const token = discordBotToken();
      if (!token) return null as unknown as DiscordClient;

      const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
      });

      client.on(Events.Error, (err) => {
        console.error("[zap discord] client error", err);
      });

      await new Promise<void>((resolve, reject) => {
        client.once(Events.ClientReady, (readyClient) => {
          console.log(`[zap discord] logged in as ${readyClient.user.tag}`);
          resolve();
        });
        client.login(token).catch(reject);
      });

      if (!client.isReady()) {
        throw new Error("Discord client finished login but is not ready");
      }

      return client;
    })().catch((err) => {
      clientPromise = null;
      console.error("[zap discord] login failed", err);
      throw err;
    });
  }
  return clientPromise;
}

export async function listBotGuilds() {
  const client = await getDiscordClient();
  if (!client?.isReady()) return [];
  return [...client.guilds.cache.values()].map((g) => ({
    id: g.id,
    name: g.name,
    iconUrl: g.iconURL(),
  }));
}

export async function listGuildVoiceChannels(guildId: string) {
  const client = await getDiscordClient();
  if (!client?.isReady()) return [];
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return [];
  await guild.channels.fetch();
  return [...guild.channels.cache.values()]
    .filter((c): c is VoiceBasedChannel => c.isVoiceBased())
    .map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type === ChannelType.GuildStageVoice ? ("stage" as const) : ("voice" as const),
    }));
}

export async function resolveVoiceChannel(guildId: string, channelId: string) {
  const client = await getDiscordClient();
  if (!client?.isReady()) throw new Error("Discord bot is not configured");
  const channel = await client.channels.fetch(channelId);
  if (!channel || !channel.isVoiceBased()) {
    throw new Error("Voice channel not found");
  }
  if (channel.guildId !== guildId) {
    throw new Error("Channel does not belong to that guild");
  }
  return channel;
}
