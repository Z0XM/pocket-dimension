import { describe, expect, test } from "bun:test";
import { formatYtDlpFailure, summarizeIngestItems } from "./errors";

describe("formatYtDlpFailure", () => {
  test("maps YouTube bot check to cookies ops hint", () => {
    const msg = formatYtDlpFailure(
      "ERROR: [youtube] abc: Sign in to confirm you’re not a bot. Use --cookies-from-browser or --cookies for the authentication."
    );
    expect(msg).toContain("YTDLP_COOKIES_B64");
    expect(msg).toContain("bot check");
  });

  test("keeps malformed-cookies error instead of the 'set cookies' hint", () => {
    const msg = formatYtDlpFailure("ERROR: Cookies file must be Netscape formatted, not JSON. See https://github.com/yt-dlp/yt-dlp/wiki/FAQ");
    expect(msg).toContain("Netscape formatted");
    expect(msg).not.toContain("bot check");
  });

  test("keeps generic ERROR line", () => {
    const msg = formatYtDlpFailure("ERROR: [youtube] xyz: Video unavailable");
    expect(msg).toContain("Video unavailable");
  });
});

describe("summarizeIngestItems", () => {
  test("exposes failure reasons for UI", () => {
    const summary = summarizeIngestItems([
      { status: "imported" },
      { status: "failed", reason: "Object storage is not configured", title: "Track A" },
      { status: "skipped", reason: "Track longer than 10 minutes", title: "Long" },
    ]);
    expect(summary.imported).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.errorMessage).toBe("Object storage is not configured");
    expect(summary.failures[0]?.title).toBe("Track A");
  });
});
