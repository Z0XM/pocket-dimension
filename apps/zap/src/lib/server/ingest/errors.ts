const MAX_REASON_LEN = 480;

type Ingestish =
  | { status: "imported" | "reused" }
  | { status: "unavailable"; reason: string; title?: string; identityKey?: string }
  | { status: "skipped"; reason: string; title?: string }
  | { status: "failed"; reason: string; title?: string; identityKey?: string };

const UNAVAILABLE_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /private video|video is private/i, reason: "Private video" },
  { re: /deleted video|has been removed|no longer available|account associated with this video has been terminated/i, reason: "Video removed" },
  {
    re: /not available in your country|blocked it in your country|geo.?restrict|not made this video available in your country/i,
    reason: "Region-blocked",
  },
  { re: /copyright (claim|grounds)/i, reason: "Removed (copyright)" },
  { re: /members-only|join this channel to get access/i, reason: "Members-only video" },
  { re: /video unavailable|this video is unavailable|video is not available/i, reason: "Video unavailable" },
];

/**
 * Map yt-dlp / YouTube errors that mean "this source is gone or blocked" to a short catalogue reason.
 * Returns null for transient or ops failures (bot check, network, storage) which stay `failed`.
 */
export function classifyUnavailableReason(message: string | null | undefined): string | null {
  if (!message) return null;
  if (/not a bot|bot check|cookies|Sign in to confirm/i.test(message)) return null;
  for (const { re, reason } of UNAVAILABLE_PATTERNS) {
    if (re.test(message)) return reason;
  }
  return null;
}

/** YouTube / yt-dlp placeholder titles for items whose metadata is hidden. */
export function isPlaceholderVideoTitle(title: string | null | undefined): boolean {
  if (!title) return true;
  return /^\[?(private|deleted) video\]?$/i.test(title.trim());
}

/** Reason for a placeholder title, or null when the title looks like real metadata. */
export function placeholderUnavailableReason(title: string | null | undefined): string | null {
  if (!title || !isPlaceholderVideoTitle(title)) return null;
  return /private/i.test(title) ? "Private video" : "Video removed";
}

/** Pull the useful yt-dlp ERROR line(s); drop wiki noise when we can add a shorter ops hint. */
export function formatYtDlpFailure(stderr: string, stdout = ""): string {
  const combined = `${stderr}\n${stdout}`.trim();
  const errorLines = combined
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^ERROR:/i.test(l) || /Sign in to confirm/i.test(l) || /HTTP Error \d+/i.test(l));

  const fallback = combined.split("\n").filter(Boolean).slice(-3).join(" ") || "yt-dlp failed";
  let message = (errorLines[0] ?? fallback).trim().replace(/^ERROR:\s*/i, "");

  // Not a bare /cookies/ match: "Cookies file must be Netscape formatted" means cookies ARE set but malformed.
  if (/not a bot|Sign in to confirm/i.test(message)) {
    message =
      "YouTube blocked this download (bot check). Set YTDLP_COOKIES_B64 or YTDLP_COOKIES_FILE on the Zap service (Netscape cookies from a logged-in browser). Connect YouTube OAuth lists playlists but ingest still needs cookies for yt-dlp.";
  }

  if (message.length > MAX_REASON_LEN) {
    message = `${message.slice(0, MAX_REASON_LEN - 1)}…`;
  }
  return message;
}

export function summarizeIngestItems(items: Ingestish[]) {
  const imported = items.filter((i) => i.status === "imported" || i.status === "reused").length;
  const unavailableItems = items.filter((i): i is Extract<Ingestish, { status: "unavailable" }> => i.status === "unavailable");
  const skipped = items.filter((i) => i.status === "skipped").length;
  const failedItems = items.filter((i): i is Extract<Ingestish, { status: "failed" }> => i.status === "failed");
  const skipItems = items.filter((i): i is Extract<Ingestish, { status: "skipped" }> => i.status === "skipped");

  const failures = failedItems.map((i) => ({
    title: i.title,
    identityKey: i.identityKey,
    reason: i.reason,
  }));
  const skips = skipItems.slice(0, 5).map((i) => ({ title: i.title, reason: i.reason }));

  const uniqueReasons = [...new Set(failures.map((f) => f.reason))];
  const errorMessage =
    uniqueReasons.length === 0 ? null : uniqueReasons.length === 1 ? uniqueReasons[0]! : `${uniqueReasons[0]} (+${uniqueReasons.length - 1} more)`;

  const unavailable = unavailableItems.map((i) => ({ title: i.title, identityKey: i.identityKey, reason: i.reason }));

  return {
    imported,
    unavailable: unavailableItems.length,
    skipped,
    failed: failedItems.length,
    errorMessage,
    failures,
    skips,
    unavailableItems: unavailable,
  };
}
