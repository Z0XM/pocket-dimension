import { parseIndianAmount } from "$lib/finance/money";
import type { ImportRow } from "$lib/importers/types";
import { merchantFromDescription } from "$lib/importers/kotak-shared";
import {
  extractIciciExternalRef,
  extractIciciMetadata,
  iciciDescriptionFromBody,
  parseIciciPdfDate,
  stripIciciPdfChunkFooter,
} from "$lib/importers/icici-shared";

const TXN_START = /(\d+)\s+(\d{2}\.\d{2}\.\d{4})\s+/g;
const TRAILING_AMOUNTS = /([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;

export function parseIciciPdf(text: string): { rows: ImportRow[]; metadata: Record<string, string> } {
  const metadata = extractIciciMetadata(text);
  const starts = [...text.matchAll(TXN_START)];

  const parsedRows: ImportRow[] = [];
  let previousBalanceMinor: number | null = null;

  for (let index = 0; index < starts.length; index += 1) {
    const match = starts[index];
    const chunkStart = match.index ?? 0;
    const chunkEnd = starts[index + 1]?.index ?? text.length;
    const chunk = stripIciciPdfChunkFooter(text.slice(chunkStart, chunkEnd).trim());
    const [, serial, dateRaw] = match;

    if (/S No\.\s+Transaction Date/i.test(chunk)) continue;

    const amountMatch = chunk.match(TRAILING_AMOUNTS);
    if (!amountMatch) continue;

    const transactionAmountMinor = parseIndianAmount(amountMatch[1]);
    const balanceMinor = parseIndianAmount(amountMatch[2]);
    if (transactionAmountMinor <= 0) continue;

    let body = chunk
      .slice(0, amountMatch.index)
      .replace(/^\d+\s+\d{2}\.\d{2}\.\d{4}\s+/, "")
      .trim();
    body = iciciDescriptionFromBody(body);

    const { externalRef, body: description } = extractIciciExternalRef(body);
    const deltaMinor = previousBalanceMinor == null ? null : balanceMinor - previousBalanceMinor;
    const type = deltaMinor == null || deltaMinor === 0 ? "expense" : deltaMinor > 0 ? "income" : "expense";

    parsedRows.push({
      occurredOn: parseIciciPdfDate(dateRaw),
      amountMinor: transactionAmountMinor,
      type,
      merchant: merchantFromDescription(description),
      externalRef,
      balanceMinor,
      sortOrder: /^\d+$/.test(serial) ? Number(serial) : undefined,
    });

    previousBalanceMinor = balanceMinor;
  }

  return { rows: parsedRows, metadata };
}
