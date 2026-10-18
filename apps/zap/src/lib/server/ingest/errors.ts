const MAX_REASON_LEN = 480;

type Ingestish =
  | { status: "imported" | "reused" }
  | { status: "skipped"; reason: string; title?: string }
  | { status: "failed"; reason: string; title?: string; identityKey?: string };

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

  return { imported, skipped, failed: failedItems.length, errorMessage, failures, skips };
}
