import { describe, expect, test } from "bun:test";
import { DISCORD_BOT_PERMISSIONS, buildDiscordInviteUrl, isDiscordConfigured, parseDiscordSinkConfig } from "./config";

import { DISCORD_VOICE_IDLE_MS, SESSION_IDLE_MS } from "$lib/server/sessions/idle";

describe("discord config", () => {
  test("Discord voice idle matches session idle (15m)", () => {
    expect(DISCORD_VOICE_IDLE_MS).toBe(SESSION_IDLE_MS);
    expect(DISCORD_VOICE_IDLE_MS).toBe(15 * 60 * 1000);
  });

  test("invite URL includes bot scope and permissions", () => {
    const url = buildDiscordInviteUrl("123456789012345678");
    expect(url).toContain("client_id=123456789012345678");
    expect(url).toContain(`permissions=${DISCORD_BOT_PERMISSIONS}`);
    expect(url).toContain("scope=bot");
  });

  test("invite URL null without client id", () => {
    expect(buildDiscordInviteUrl(null)).toBeNull();
  });

  test("parseDiscordSinkConfig", () => {
    expect(parseDiscordSinkConfig(null)).toBeNull();
    expect(parseDiscordSinkConfig("{")).toBeNull();
    expect(parseDiscordSinkConfig(JSON.stringify({ guildId: "g", channelId: "c", guildName: "G" }))).toEqual({
      guildId: "g",
      channelId: "c",
      guildName: "G",
      channelName: undefined,
    });
  });

  test("isDiscordConfigured requires token + client id", () => {
    const prevT = Bun.env.DISCORD_BOT_TOKEN;
    const prevC = Bun.env.DISCORD_CLIENT_ID;
    Bun.env.DISCORD_BOT_TOKEN = "";
    Bun.env.DISCORD_CLIENT_ID = "";
    expect(isDiscordConfigured()).toBe(false);
    Bun.env.DISCORD_BOT_TOKEN = "tok";
    Bun.env.DISCORD_CLIENT_ID = "cid";
    expect(isDiscordConfigured()).toBe(true);
    Bun.env.DISCORD_BOT_TOKEN = prevT;
    Bun.env.DISCORD_CLIENT_ID = prevC;
  });
});
