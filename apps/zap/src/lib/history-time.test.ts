import { describe, expect, test } from "bun:test";
import {
  parseBeforeCursor,
  parseHistoryTimeRange,
  sinceForHistoryRange,
  songHref,
  youtubePlaylistHref,
} from "./history-time";

describe("history time range", () => {
  test("parses known presets and defaults unknown to all", () => {
    expect(parseHistoryTimeRange("hour")).toBe("hour");
    expect(parseHistoryTimeRange("today")).toBe("today");
    expect(parseHistoryTimeRange("week")).toBe("week");
    expect(parseHistoryTimeRange("month")).toBe("month");
    expect(parseHistoryTimeRange("quarter")).toBe("quarter");
    expect(parseHistoryTimeRange("all")).toBe("all");
    expect(parseHistoryTimeRange("nope")).toBe("all");
    expect(parseHistoryTimeRange(null)).toBe("all");
  });

  test("sinceForHistoryRange returns bounds relative to now", () => {
    // Wednesday 2026-10-14 15:30 local
    const now = new Date(2026, 9, 14, 15, 30, 0);
    expect(sinceForHistoryRange("all", now)).toBeNull();

    const hour = sinceForHistoryRange("hour", now)!;
    expect(hour.getTime()).toBe(now.getTime() - 60 * 60 * 1000);

    const today = sinceForHistoryRange("today", now)!;
    expect(today.getFullYear()).toBe(2026);
    expect(today.getMonth()).toBe(9);
    expect(today.getDate()).toBe(14);
    expect(today.getHours()).toBe(0);

    const week = sinceForHistoryRange("week", now)!;
    // Monday Oct 12
    expect(week.getDate()).toBe(12);
    expect(week.getHours()).toBe(0);

    const month = sinceForHistoryRange("month", now)!;
    expect(month.getDate()).toBe(1);
    expect(month.getMonth()).toBe(9);

    const quarter = sinceForHistoryRange("quarter", now)!;
    expect(quarter.getTime()).toBe(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  });

  test("parseBeforeCursor rejects invalid dates", () => {
    expect(parseBeforeCursor(null)).toBeNull();
    expect(parseBeforeCursor("not-a-date")).toBeNull();
    expect(parseBeforeCursor("2026-10-14T12:00:00.000Z")?.toISOString()).toBe("2026-10-14T12:00:00.000Z");
  });
});

describe("song and playlist hrefs", () => {
  test("prefers http(s) source URL", () => {
    expect(songHref("https://youtu.be/abc", "Song", "id-1")).toBe("https://youtu.be/abc");
    expect(songHref("ftp://nope", "Song", "id-1")).toBe("/catalogue?q=Song");
    expect(songHref(null, "Rain", "id-2")).toBe("/catalogue?q=Rain");
  });

  test("builds youtube playlist links", () => {
    expect(youtubePlaylistHref("PLabc")).toBe("https://www.youtube.com/playlist?list=PLabc");
  });
});
