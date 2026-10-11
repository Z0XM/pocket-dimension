/**
 * Phase 5 smoke (no GUI / no live Discord required):
 * invite URL + sync helpers + unauth API gates.
 */
import { buildDiscordInviteUrl, isDiscordConfigured } from "../src/lib/server/discord/config";
import { playbackCommandFromSnapshot } from "../src/lib/server/discord/sync";

const BASE = process.env.ZAP_URL ?? "http://localhost:3013";

console.log("configured", isDiscordConfigured());
console.log("invite", buildDiscordInviteUrl("999")?.includes("client_id=999") ? "OK" : "FAIL");

const idle = playbackCommandFromSnapshot({
  version: 0,
  serverNow: new Date().toISOString(),
  session: null,
  currentItem: null,
  queue: [],
  members: [],
  me: null,
});
console.log("idle snapshot", idle.action === "idle" ? "OK" : "FAIL");

const unauth = await fetch(`${BASE}/api/discord/status`);
console.log("unauth status", unauth.status, unauth.status === 401 || unauth.status === 403 ? "OK" : "unexpected");

const unauthGuilds = await fetch(`${BASE}/api/discord/guilds`);
console.log("unauth guilds", unauthGuilds.status, unauthGuilds.status === 401 || unauthGuilds.status === 403 ? "OK" : "unexpected");

console.log("discord-sink-smoke done");
