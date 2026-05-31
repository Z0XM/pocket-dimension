import { parseIndianAmount } from "$lib/finance/money";
import type { ImportRow } from "$lib/importers/types";
import {
  extractKotakExternalRef,
  extractKotakMetadata,
  merchantFromDescription,
  parseKotakPdfDate,
  stripKotakPdfChunkFooter,
} from "$lib/importers/kotak-shared";

const TXN_START = /(\d+)\s+(\d{1,2}\s+\w{3}\s+\d{4})\s+/g;
const TRAILING_AMOUNTS = /([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;

export function parseKotakPdf(text: string): { rows: ImportRow[]; metadata: Record<string, string> } {
  const metadata = extractKotakMetadata(text);
  const starts = [...text.matchAll(TXN_START)];

  const parsedRows: ImportRow[] = [];
  let previousBalanceMinor = 0;

  for (let index = 0; index < starts.length; index += 1) {
    const match = starts[index];
    const chunkStart = match.index ?? 0;
    const chunkEnd = starts[index + 1]?.index ?? text.length;
    const chunk = stripKotakPdfChunkFooter(text.slice(chunkStart, chunkEnd).trim());
    const [, serial, dateRaw] = match;

    if (/opening balance/i.test(chunk)) continue;

    const amountMatch = chunk.match(TRAILING_AMOUNTS);
    if (!amountMatch) continue;

    const transactionAmountMinor = parseIndianAmount(amountMatch[1]);
    const balanceMinor = parseIndianAmount(amountMatch[2]);
    let body = chunk
      .slice(0, amountMatch.index)
      .replace(/^\d+\s+\d{1,2}\s+\w{3}\s+\d{4}\s+/, "")
      .trim();

    const { externalRef, body: description } = extractKotakExternalRef(body);
    body = description;

    const deltaMinor = balanceMinor - previousBalanceMinor;
    if (deltaMinor === 0) {
      previousBalanceMinor = balanceMinor;
      continue;
    }

    parsedRows.push({
      occurredOn: parseKotakPdfDate(dateRaw),
      amountMinor: transactionAmountMinor,
      type: deltaMinor > 0 ? "income" : "expense",
      merchant: merchantFromDescription(body),
      externalRef,
      balanceMinor,
      sortOrder: /^\d+$/.test(serial) ? Number(serial) : undefined,
    });

    previousBalanceMinor = balanceMinor;
  }

  return { rows: parsedRows, metadata };
}
