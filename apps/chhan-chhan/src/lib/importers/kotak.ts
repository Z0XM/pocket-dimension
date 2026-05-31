import { parseIndianAmount } from "$lib/finance/money";
import type { BankImporter, StatementInput } from "$lib/importers/types";
import { merchantFromDescription, parseKotakCsvDate } from "$lib/importers/kotak-shared";
import { parseKotakPdf } from "$lib/importers/kotak-pdf";
import { parseCsvRows } from "$lib/server/csv-parse";
import { extractPdfText } from "$lib/server/pdf-text";

const HEADER_MARK = "transaction date";

function extractCsvMetadata(rows: string[][]): Record<string, string> {
  const metadata: Record<string, string> = {};
  for (const row of rows.slice(0, 20)) {
    for (const cell of row) {
      const match = cell.match(/^([^,]+),\s*(.+)$/);
      if (!match) continue;
      const key = match[1].trim().toLowerCase();
      const value = match[2].trim();
      if (key.includes("account no")) metadata.accountNumber = value;
      if (key.includes("period")) metadata.period = value;
      if (key.includes("currency")) metadata.currency = value;
      if (key.includes("ifsc")) metadata.ifsc = value;
    }
  }
  return metadata;
}

function findHeaderIndex(rows: string[][]): number {
  return rows.findIndex((row) => row.some((cell) => cell.trim().toLowerCase() === HEADER_MARK));
}

function parseKotakCsv(text: string) {
  const rawRows = parseCsvRows(text);
  const metadata = extractCsvMetadata(rawRows);
  const headerIndex = findHeaderIndex(rawRows);
  if (headerIndex === -1) {
    throw new Error("Kotak statement header row not found");
  }

  const parsedRows = [];
  for (const row of rawRows.slice(headerIndex + 1)) {
    const firstCell = row[0]?.trim() ?? "";
    if (!firstCell || !/^\d+$/.test(firstCell)) continue;

    const [serial = "", transactionDate = "", valueDate = "", description = "", reference = "", amountRaw = "", direction = "", balanceRaw = ""] =
      row;

    if (!amountRaw || !direction) continue;

    const normalizedDirection = direction.trim().toUpperCase();
    const type = normalizedDirection === "CR" ? "income" : "expense";
    const amountMinor = parseIndianAmount(amountRaw);
    const sortOrder = /^\d+$/.test(serial.trim()) ? Number(serial.trim()) : undefined;

    parsedRows.push({
      occurredOn: parseKotakCsvDate(valueDate || transactionDate),
      amountMinor,
      type,
      merchant: merchantFromDescription(description),
      externalRef: reference.trim() || undefined,
      balanceMinor: balanceRaw.trim() ? parseIndianAmount(balanceRaw) : undefined,
      sortOrder,
    });
  }

  return { rows: parsedRows, metadata };
}

function isPdfInput(input: StatementInput): boolean {
  const name = input.fileName.toLowerCase();
  return input.mimeType === "application/pdf" || name.endsWith(".pdf");
}

export const kotakImporter: BankImporter = {
  id: "kotak",
  label: "Kotak Mahindra Bank",
  accept: ".csv,.pdf,text/csv,application/pdf",
  async parse(input) {
    if (isPdfInput(input)) {
      const text = await extractPdfText(input.bytes);
      return parseKotakPdf(text);
    }

    const text = new TextDecoder().decode(input.bytes);
    return parseKotakCsv(text);
  },
};
