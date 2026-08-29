import type { ExternalGap } from "./types.js";

function inferGapStatus(summary: string): ExternalGap["status"] {
  const lower = summary.toLowerCase();
  // Check partial markers before bare "complete" — "partially complete" and
  // "incomplete" both contain the substring "complete".
  if (lower.includes("partially complete") || lower.includes("validated for")) {
    return "partial";
  }
  if (/\bincomplete\b/.test(lower)) return "open";
  if (/\bcomplete\b/.test(lower) || lower.includes("closed by")) return "closed";
  return "open";
}

export function parseExternalGaps(content: string): ExternalGap[] {
  const gaps: ExternalGap[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const match = line.match(/^\|\s*(EXT-\d+)\s*\|\s*([^|]+)\|\s*([^|]+)\|/);
    if (!match) continue;

    const [, id, summary, owner] = match;
    gaps.push({
      id: id.trim(),
      summary: summary.trim(),
      owner: owner.trim(),
      status: inferGapStatus(summary),
    });
  }

  return gaps;
}

export function findAffectedStories(gapId: string, stories: { id: string; blockers: string[] }[]): string[] {
  return stories
    .filter((s) => s.blockers.some((b) => b.includes(gapId)) || s.blockers.some((b) => b.toLowerCase().includes(gapId.toLowerCase())))
    .map((s) => s.id);
}
