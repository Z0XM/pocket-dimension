interface CsvReadOptions {
  delimiter?: string;
  quote?: string;
  skipEmptyRows?: boolean;
  trimFields?: boolean;
  skipHeader?: boolean;
}

export interface CsvReadResult {
  headers: string[];
  rows: string[][];
}

function parseCSVLine(line: string, delimiter: string, quote: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === quote) {
      if (inQuotes && nextChar === quote) {
        // Escaped quote
        current += quote;
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // Field separator
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current); // Push last field
  return result;
}

export const readAsCsv = async (path: string, options: CsvReadOptions = {}): Promise<CsvReadResult> => {
  const { delimiter = ",", quote = '"', skipEmptyRows = true, trimFields = true, skipHeader = false } = options;

  const file = Bun.file(path);
  const content = await file.text();
  const lines = content.split(/\r?\n/);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Parse all lines
  const parsedLines: string[][] = [];
  for (const line of lines) {
    if (skipEmptyRows && line.trim().length === 0) {
      continue;
    }
    const fields = parseCSVLine(line, delimiter, quote);
    const processedFields = trimFields ? fields.map((field) => field.trim()) : fields;
    parsedLines.push(processedFields);
  }

  if (parsedLines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Extract headers and rows
  if (skipHeader) {
    return {
      headers: [],
      rows: parsedLines,
    };
  }

  const headers = parsedLines[0] || [];
  const rows = parsedLines.slice(1);

  return {
    headers,
    rows,
  };
};
