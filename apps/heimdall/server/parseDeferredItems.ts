import type { DeferredItem, DeferredItemKind, DeferredItemStatus } from "./types.js";

const VALID_KIND: DeferredItemKind[] = ["product", "integration", "engineering", "tooling"];
const VALID_STATUS: DeferredItemStatus[] = ["deferred", "done", "cancelled"];

function asKind(raw: string): DeferredItemKind {
  const value = raw.trim().toLowerCase();
  return VALID_KIND.includes(value as DeferredItemKind) ? (value as DeferredItemKind) : "product";
}

function asStatus(raw: string): DeferredItemStatus {
  const value = raw.trim().toLowerCase();
  return VALID_STATUS.includes(value as DeferredItemStatus) ? (value as DeferredItemStatus) : "deferred";
}

/**
 * Parses `docs/requirements/DEFERRED-INDEX.md` Active deferred items table.
 * Only rows with Status = deferred are returned for the dashboard list.
 */
export function parseDeferredItems(content: string): DeferredItem[] {
  const items: DeferredItem[] = [];
  const section = content.match(/## Active deferred items([\s\S]*?)(?=\n## Kind legend|\n## Status legend|\n## |$)/);
  if (!section) return items;

  for (const line of section[1].split("\n")) {
    const match = line.match(/^\|\s*(D-\d+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/);
    if (!match) continue;
    if (match[1].trim() === "ID") continue;

    const status = asStatus(match[6]);
    if (status !== "deferred") continue;

    items.push({
      id: match[1].trim(),
      kind: asKind(match[2]),
      summary: match[3].trim(),
      source: match[4].trim(),
      timing: match[5].trim(),
      status,
    });
  }

  return items;
}
