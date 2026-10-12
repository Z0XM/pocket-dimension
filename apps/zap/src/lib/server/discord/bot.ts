import { Client, GatewayIntentBits, ChannelType, type VoiceBasedChannel } from "discord.js";
import { discordBotToken, isDiscordConfigured } from "./config";

let clientPromise: Promise<Client> | null = null;

export async function getDiscordClient(): Promise<Client | null> {
  if (!isDiscordConfigured()) return null;
  if (!clientPromise) {
    clientPromise = (async () => {
      const token = discordBotToken();
      if (!token) return null as unknown as Client;

      const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
      });

      await new Promise<void>((resolve, reject) => {
        client.once("ready", () => resolve());
        client.once("error", reject);
        client.login(token).catch(reject);
      });

      console.log(`[zap discord] logged in as ${client.user?.tag}`);
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
  if (!client) return [];
  return [...client.guilds.cache.values()].map((g) => ({
    id: g.id,
    name: g.name,
    iconUrl: g.iconURL(),
  }));
}

export async function listGuildVoiceChannels(guildId: string) {
  const client = await getDiscordClient();
  if (!client) return [];
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return [];
  await guild.channels.fetch();
  return [...guild.channels.cache.values()]
    .filter((c): c is VoiceBasedChannel => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice)
    .map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type === ChannelType.GuildStageVoice ? "stage" : "voice",
    }));
}

export async function resolveVoiceChannel(guildId: string, channelId: string) {
  const client = await getDiscordClient();
  if (!client) throw new Error("Discord bot is not configured");
  const channel = await client.channels.fetch(channelId);
  if (!channel || (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice)) {
    throw new Error("Voice channel not found");
  }
  if ("guildId" in channel && channel.guildId !== guildId) {
    throw new Error("Channel does not belong to that guild");
  }
  return channel as VoiceBasedChannel;
}
