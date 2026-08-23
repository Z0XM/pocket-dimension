export type StoryStatus = "backlog" | "in-progress" | "done" | "unknown";

const STATUS_LINE = /^Status:\s*(.+)\s*$/m;
const BOLD_STATUS_LINE = /^\*\*Status:\*\*\s*(.+)\s*$/m;

/** Raw Status: line when present; never invent. */
export function extractStatusLine(markdown: string): string | null {
  const head = markdown.slice(0, 8192);
  const match = head.match(STATUS_LINE) ?? head.match(BOLD_STATUS_LINE);
  if (!match?.[1]) {
    return null;
  }

  const label = stripMarkdownDecor(match[1]).trim();
  return label.length > 0 ? label : null;
}

function stripMarkdownDecor(raw: string): string {
  return raw.replace(/\*\*/g, "").replace(/`/g, "").trim();
}

/** Map common labels → union; extras → "unknown" but keep statusLabel. */
export function mapStatusLabel(raw: string): { status: StoryStatus; statusLabel: string } {
  const statusLabel = raw.trim();
  const normalized = statusLabel.toLowerCase();

  if (normalized === "backlog") {
    return { status: "backlog", statusLabel };
  }

  if (normalized === "done" || normalized === "complete" || normalized === "completed") {
    return { status: "done", statusLabel };
  }

  if (normalized === "in-progress") {
    return { status: "in-progress", statusLabel };
  }

  if (normalized === "ready-for-dev" || normalized === "review" || normalized === "contexted" || normalized === "optional") {
    return { status: "unknown", statusLabel };
  }

  return { status: "unknown", statusLabel };
}
