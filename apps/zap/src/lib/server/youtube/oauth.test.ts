import { afterEach, describe, expect, test, mock, spyOn } from "bun:test";
import { buildYouTubeOAuthUrl, isGoogleOAuthConfigured, tryRefreshYouTubeAccessToken, youtubeRedirectUri } from "./oauth";

const originalFetch = globalThis.fetch;

describe("youtube oauth helpers", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("isGoogleOAuthConfigured", () => {
    const prevId = Bun.env.GOOGLE_CLIENT_ID;
    const prevSecret = Bun.env.GOOGLE_CLIENT_SECRET;
    Bun.env.GOOGLE_CLIENT_ID = "";
    Bun.env.GOOGLE_CLIENT_SECRET = "";
    expect(isGoogleOAuthConfigured()).toBe(false);
    Bun.env.GOOGLE_CLIENT_ID = "cid";
    Bun.env.GOOGLE_CLIENT_SECRET = "csecret";
    expect(isGoogleOAuthConfigured()).toBe(true);
    Bun.env.GOOGLE_CLIENT_ID = prevId;
    Bun.env.GOOGLE_CLIENT_SECRET = prevSecret;
  });

  test("buildYouTubeOAuthUrl includes offline consent scopes", () => {
    Bun.env.GOOGLE_CLIENT_ID = "cid";
    Bun.env.GOOGLE_CLIENT_SECRET = "csecret";
    const url = buildYouTubeOAuthUrl({ requestUrl: new URL("http://localhost:3013/x"), state: "abc" });
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("abc");
    expect(url.searchParams.get("scope") ?? "").toContain("youtube.readonly");
    expect(youtubeRedirectUri(new URL("http://localhost:3013/x"))).toBe("http://localhost:3013/api/auth/youtube/callback");
  });

  test("tryRefreshYouTubeAccessToken returns null on Google error", async () => {
    Bun.env.GOOGLE_CLIENT_ID = "cid";
    Bun.env.GOOGLE_CLIENT_SECRET = "csecret";
    globalThis.fetch = mock(async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })) as unknown as typeof fetch;
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const result = await tryRefreshYouTubeAccessToken("stale");
    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[1]).toEqual({ status: 400, error: "invalid_grant", description: undefined });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("stale");
    warn.mockRestore();
  });
});
