import { parseIndianAmount } from "$lib/finance/money";
import type { BankImporter, ImportRow, StatementInput } from "$lib/importers/types";
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

function balanceChainBreakCount(rows: ImportRow[]): number {
  let breaks = 0;
  for (let i = 1; i < rows.length; i += 1) {
    const prev = rows[i - 1]!;
    const next = rows[i]!;
    if (prev.balanceMinor == null || next.balanceMinor == null) continue;
    const expected = next.type === "income" ? prev.balanceMinor + next.amountMinor : prev.balanceMinor - next.amountMinor;
    if (expected !== next.balanceMinor) breaks += 1;
  }
  return breaks;
}

/**
 * Kotak CSV exports are sometimes oldest→newest (serial 1 = oldest) and sometimes
 * newest→oldest (serial 1 = newest). Detect and normalize to oldest→newest with
 * sortOrder increasing over time.
 */
export function normalizeKotakCsvChronology(rows: ImportRow[]): ImportRow[] {
  if (rows.length < 2) return rows;

  const firstDate = rows[0]?.occurredOn;
  const lastDate = rows[rows.length - 1]?.occurredOn;
  let newestFirst = false;

  if (firstDate && lastDate && firstDate !== lastDate) {
    newestFirst = firstDate > lastDate;
  } else {
    // Same endpoint dates: prefer the serial direction that keeps the balance chain intact.
    const bySerialAsc = [...rows].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const bySerialDesc = [...bySerialAsc].reverse();
    newestFirst = balanceChainBreakCount(bySerialDesc) < balanceChainBreakCount(bySerialAsc);
  }

  if (!newestFirst) return rows;

  const normalized = [...rows].reverse();
  const serials = normalized.map((row) => row.sortOrder).filter((value): value is number => value != null);
  if (serials.length) {
    const maxSerial = Math.max(...serials);
    const minSerial = Math.min(...serials);
    for (const row of normalized) {
      if (row.sortOrder == null) continue;
      row.sortOrder = maxSerial + minSerial - row.sortOrder;
    }
  }
  return normalized;
}

export function parseKotakCsv(text: string) {
  const rawRows = parseCsvRows(text);
  const metadata = extractCsvMetadata(rawRows);
  const headerIndex = findHeaderIndex(rawRows);
  if (headerIndex === -1) {
    throw new Error("Kotak statement header row not found");
  }

  const parsedRows: ImportRow[] = [];
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

  return { rows: normalizeKotakCsvChronology(parsedRows), metadata };
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
