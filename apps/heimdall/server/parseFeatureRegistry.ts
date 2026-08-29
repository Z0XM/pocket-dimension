import type { FeatureRecord } from "./types.js";
import { resolveFeatureArea } from "./featureAreas.js";

interface TableRow {
  id: string;
  name: string;
  screens: string[];
  epicId: string;
  status: string;
}

interface DetailBlock {
  goal?: string;
  includes: string[];
  deferred: string[];
  seeAlso: string[];
  area?: string;
}

function parseTableRows(content: string): TableRow[] {
  const rows: TableRow[] = [];
  for (const line of content.split("\n")) {
    const match = line.match(/^\|\s*(F-\d+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]*)\|\s*(Epic \d+)[^|]*\|\s*([^|]+)\|/);
    if (!match) continue;

    const [, id, name, screensRaw, , epicRaw, status] = match;
    const epicId = epicRaw.trim().toLowerCase().replace(" ", "-");
    const screens = screensRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    rows.push({
      id: id.trim(),
      name: name.trim(),
      screens,
      epicId,
      status: status.trim(),
    });
  }
  return rows;
}

function parseBulletList(lines: string[], startIndex: number): { items: string[]; nextIndex: number } {
  const items: string[] = [];
  let i = startIndex;
  while (i < lines.length) {
    const line = lines[i];
    if (/^###\s+F-\d+/.test(line)) break;
    if (/^-\s+\*\*[^*]+\*\*:/.test(line)) break;
    const bullet = line.match(/^\s+-\s+(.+)$/);
    if (bullet) {
      items.push(bullet[1].trim());
      i += 1;
      continue;
    }
    if (line.trim() === "") {
      i += 1;
      continue;
    }
    break;
  }
  return { items, nextIndex: i };
}

function isPlaceholderItem(item: string): boolean {
  return /^none currently\.?$/i.test(item.trim());
}

function parseDetailBlocks(content: string): Map<string, DetailBlock> {
  const map = new Map<string, DetailBlock>();
  const lines = content.split("\n");
  let currentId: string | null = null;
  let block: DetailBlock | null = null;

  const flush = () => {
    if (currentId && block) map.set(currentId, block);
  };

  for (let i = 0; i < lines.length; i++) {
    const heading = lines[i].match(/^###\s+(F-\d+)\s+[—–-]\s+(.+)$/);
    if (heading) {
      flush();
      currentId = heading[1];
      block = { includes: [], deferred: [], seeAlso: [] };
      continue;
    }
    if (!currentId || !block) continue;

    const goal = lines[i].match(/^-\s+\*\*Goal:\*\*\s*(.+)$/i);
    if (goal) {
      block.goal = goal[1].trim();
      continue;
    }

    const area = lines[i].match(/^-\s+\*\*Area:\*\*\s*(.+)$/i);
    if (area) {
      block.area = area[1].trim();
      continue;
    }

    if (/^-\s+\*\*Includes:\*\*\s*$/i.test(lines[i])) {
      const { items, nextIndex } = parseBulletList(lines, i + 1);
      block.includes = items;
      i = nextIndex - 1;
      continue;
    }

    // Preferred heading, plus legacy "Out of scope for now"
    if (/^-\s+\*\*Deferred:\*\*\s*$/i.test(lines[i]) || /^-\s+\*\*Out of scope for now:\*\*\s*$/i.test(lines[i])) {
      const { items, nextIndex } = parseBulletList(lines, i + 1);
      block.deferred = items.filter((item) => !isPlaceholderItem(item));
      i = nextIndex - 1;
      continue;
    }

    if (/^-\s+\*\*See also:\*\*\s*$/i.test(lines[i]) || /^-\s+\*\*Owned elsewhere:\*\*\s*$/i.test(lines[i])) {
      const { items, nextIndex } = parseBulletList(lines, i + 1);
      block.seeAlso = items.filter((item) => !isPlaceholderItem(item));
      i = nextIndex - 1;
      continue;
    }
  }

  flush();
  return map;
}

export function parseFeatureRegistry(content: string): FeatureRecord[] {
  const rows = parseTableRows(content);
  const details = parseDetailBlocks(content);

  return rows.map((row) => {
    const detail = details.get(row.id);
    const resolved = resolveFeatureArea(row.id, detail?.area);
    const deferred = detail?.deferred ?? [];
    return {
      id: row.id,
      name: row.name,
      epicId: row.epicId,
      screens: row.screens,
      status: row.status,
      goal: detail?.goal,
      includes: detail?.includes ?? [],
      deferred,
      seeAlso: detail?.seeAlso ?? [],
      outOfScope: deferred,
      areaId: resolved.id,
      area: resolved.label,
    };
  });
}

export function featuresByEpic(features: FeatureRecord[]): Map<string, FeatureRecord[]> {
  const map = new Map<string, FeatureRecord[]>();
  for (const f of features) {
    const list = map.get(f.epicId) ?? [];
    list.push(f);
    map.set(f.epicId, list);
  }
  return map;
}
