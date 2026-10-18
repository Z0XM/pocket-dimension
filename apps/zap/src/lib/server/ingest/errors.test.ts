import { describe, expect, test } from "bun:test";
import { classifyUnavailableReason, formatYtDlpFailure, isPlaceholderVideoTitle, placeholderUnavailableReason, summarizeIngestItems } from "./errors";

describe("formatYtDlpFailure", () => {
  test("maps YouTube bot check to cookies ops hint", () => {
    const msg = formatYtDlpFailure(
      "ERROR: [youtube] abc: Sign in to confirm you’re not a bot. Use --cookies-from-browser or --cookies for the authentication."
    );
    expect(msg).toContain("YTDLP_COOKIES_B64");
    expect(msg).toContain("bot check");
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

  test("counts unavailable rows separately from imported and failed", () => {
    const summary = summarizeIngestItems([
      { status: "imported" },
      { status: "unavailable", reason: "Private video", title: "Private video", identityKey: "youtube:abc" },
      { status: "unavailable", reason: "Region-blocked", title: "Song B", identityKey: "youtube:def" },
    ]);
    expect(summary.imported).toBe(1);
    expect(summary.unavailable).toBe(2);
    expect(summary.failed).toBe(0);
    expect(summary.errorMessage).toBeNull();
    expect(summary.unavailableItems.map((i) => i.reason)).toEqual(["Private video", "Region-blocked"]);
  });
});

describe("classifyUnavailableReason", () => {
  test.each([
    ["ERROR: [youtube] abc: Private video. Sign in if you've been granted access to this video", "Private video"],
    ["[youtube] abc: Video unavailable. This video has been removed by the uploader", "Video removed"],
    [
      "Video unavailable. This video is no longer available because the YouTube account associated with this video has been terminated.",
      "Video removed",
    ],
    ["Video unavailable. The uploader has not made this video available in your country", "Region-blocked"],
    ["This video is not available in your country", "Region-blocked"],
    ["Video unavailable. This video contains content from UMG, who has blocked it in your country on copyright grounds", "Region-blocked"],
    ["Join this channel to get access to members-only content like this video", "Members-only video"],
    ["[youtube] abc: Video unavailable", "Video unavailable"],
  ])("%s → %s", (message, reason) => {
    expect(classifyUnavailableReason(message)).toBe(reason);
  });

  test("transient / ops failures stay failed", () => {
    expect(classifyUnavailableReason(formatYtDlpFailure("ERROR: [youtube] abc: Sign in to confirm you’re not a bot."))).toBeNull();
    expect(classifyUnavailableReason("Object storage is not configured")).toBeNull();
    expect(classifyUnavailableReason("HTTP Error 503: Service Unavailable")).toBeNull();
    expect(classifyUnavailableReason(null)).toBeNull();
  });
});

describe("placeholder titles", () => {
  test("detects YouTube API and yt-dlp placeholders", () => {
    expect(isPlaceholderVideoTitle("Private video")).toBe(true);
    expect(isPlaceholderVideoTitle("[Deleted video]")).toBe(true);
    expect(isPlaceholderVideoTitle("Private Video Diaries")).toBe(false);
    expect(placeholderUnavailableReason("[Private video]")).toBe("Private video");
    expect(placeholderUnavailableReason("Deleted video")).toBe("Video removed");
    expect(placeholderUnavailableReason("Real Song")).toBeNull();
  });
});
