/** RFC 4180-style CSV row parser (handles quoted commas and newlines). */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }

  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }

  return rows;
}

export function rowsToObjects(rows: string[][]): Array<Record<string, string>> {
  if (!rows.length) return [];
  const header = rows[0].map((key) => key.trim());
  return rows.slice(1).map((values) => {
    const row: Record<string, string> = {};
    header.forEach((key, index) => {
      row[key] = values[index]?.trim() ?? "";
    });
    return row;
  });
}
