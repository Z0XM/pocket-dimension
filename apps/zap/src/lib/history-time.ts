/** Smart time presets for History Play / Uploads tables. */

export const HISTORY_TIME_RANGES = ["hour", "today", "week", "month", "quarter", "all"] as const;
export type HistoryTimeRange = (typeof HISTORY_TIME_RANGES)[number];

export const HISTORY_TIME_RANGE_OPTIONS: { value: HistoryTimeRange; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "hour", label: "Last hour" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "quarter", label: "Last 90 days" },
];

export function parseHistoryTimeRange(raw: string | null | undefined): HistoryTimeRange {
  return (HISTORY_TIME_RANGES as readonly string[]).includes(raw ?? "") ? (raw as HistoryTimeRange) : "all";
}

/** Start of local calendar day for `now` (browser/server local TZ). */
function startOfLocalDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Monday 00:00 local of the week containing `now`. */
function startOfLocalWeek(now: Date): Date {
  const day = startOfLocalDay(now);
  const weekday = day.getDay(); // 0 Sun … 6 Sat
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  day.setDate(day.getDate() + mondayOffset);
  return day;
}

function startOfLocalMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** Lower bound (inclusive) for the preset, or null for all time. */
export function sinceForHistoryRange(range: HistoryTimeRange, now = new Date()): Date | null {
  switch (range) {
    case "hour":
      return new Date(now.getTime() - 60 * 60 * 1000);
    case "today":
      return startOfLocalDay(now);
    case "week":
      return startOfLocalWeek(now);
    case "month":
      return startOfLocalMonth(now);
    case "quarter":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "all":
      return null;
  }
}

export function parseBeforeCursor(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Prefer origin/source URL; otherwise deep-link into catalogue search. */
export function songHref(externalUrl: string | null | undefined, title: string, mediaAssetId: string): string {
  if (externalUrl && isHttpUrl(externalUrl)) return externalUrl;
  const q = title.trim() || mediaAssetId;
  return `/catalogue?q=${encodeURIComponent(q)}`;
}

export function youtubePlaylistHref(playlistId: string): string {
  return `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
}
