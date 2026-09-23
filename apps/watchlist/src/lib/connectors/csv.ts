/**
 * Minimal CSV helpers for connector export/import.
 * Escapes fields per RFC 4180-ish rules (quotes, commas, newlines).
 */

export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(columns: string[], rows: Array<Record<string, unknown>>): string {
  const header = columns.map(escapeCsvField).join(",");
  const body = rows.map((row) => columns.map((col) => escapeCsvField(row[col])).join(",")).join("\n");
  return body ? `${header}\n${body}\n` : `${header}\n`;
}

/** Parse a simple CSV (supports quoted fields with commas/newlines). */
export function parseCsv(text: string): { headers: string[]; rows: Array<Record<string, string>> } {
  const records = parseCsvRecords(text);
  if (records.length === 0) return { headers: [], rows: [] };

  const headers = records[0].map((h) => h.trim());
  const rows = records.slice(1).map((fields) => {
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = fields[i] ?? "";
    }
    return row;
  });
  return { headers, rows };
}

function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    // Skip trailing empty line
    if (row.length === 1 && row[0] === "" && field === "" && records.length > 0) {
      row = [];
      return;
    }
    pushField();
    records.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\n") {
      pushRow();
    } else if (ch === "\r") {
      if (next === "\n") i++;
      pushRow();
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return records.filter((r) => !(r.length === 1 && r[0] === ""));
}
