import { afterEach, describe, expect, it, mock } from "bun:test";

const originalFetch = globalThis.fetch;

function seedZeoEnv() {
  Bun.env.DATABASE_URL = Bun.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/postgres";
  Bun.env.LIVEKIT_API_KEY = Bun.env.LIVEKIT_API_KEY ?? "test-livekit-key";
  Bun.env.LIVEKIT_API_SECRET = Bun.env.LIVEKIT_API_SECRET ?? "test-livekit-secret";
  Bun.env.GOOGLE_CLIENT_ID = "test-client-id";
  Bun.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
}

describe("tryRefreshYouTubeAccessToken", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns null when Google rejects the refresh instead of throwing", async () => {
    seedZeoEnv();

    globalThis.fetch = mock(async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })) as typeof fetch;

    const { tryRefreshYouTubeAccessToken } = await import("./youtube-oauth");
    const result = await tryRefreshYouTubeAccessToken("stale-refresh-token");
    expect(result).toBeNull();
  });
});
