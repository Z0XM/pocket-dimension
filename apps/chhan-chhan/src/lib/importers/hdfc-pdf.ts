import { parseIndianAmount } from "$lib/finance/money";
import type { ImportRow } from "$lib/importers/types";
import {
  extractHdfcExternalRef,
  extractHdfcMetadata,
  merchantFromHdfcDescription,
  parseHdfcPdfDate,
  stripHdfcPdfChunkFooter,
} from "$lib/importers/hdfc-shared";

/** Transaction date at start of a row (value dates are followed by amounts, not letters). */
const TXN_START = /(\d{2}\/\d{2}\/\d{2})\s+(?=[A-Za-z])/g;

/** Chq./Ref.No. + Value Dt + Withdrawal|Deposit amt + Closing Balance [+ wrapped narration]. */
const TRAILING = /(\d{10,})\s+(\d{2}\/\d{2}\/\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})(?:\s+(.+))?$/;

export function parseHdfcPdf(text: string): { rows: ImportRow[]; metadata: Record<string, string> } {
  const metadata = extractHdfcMetadata(text);
  const starts = [...text.matchAll(TXN_START)];

  const parsedRows: ImportRow[] = [];
  let previousBalanceMinor: number | null = metadata.openingBalance != null ? parseIndianAmount(metadata.openingBalance) : null;

  for (let index = 0; index < starts.length; index += 1) {
    const match = starts[index];
    const chunkStart = match.index ?? 0;
    const chunkEnd = starts[index + 1]?.index ?? text.length;
    const chunk = stripHdfcPdfChunkFooter(text.slice(chunkStart, chunkEnd).trim());
    const [, dateRaw] = match;

    if (/^Date\s+Narration/i.test(chunk)) continue;

    const trailing = chunk.match(TRAILING);
    if (!trailing) continue;

    const [, refRaw, , amountRaw, balanceRaw, wrap] = trailing;
    const amountMinor = parseIndianAmount(amountRaw);
    const balanceMinor = parseIndianAmount(balanceRaw);
    if (amountMinor <= 0) continue;

    let narration = chunk
      .slice(0, trailing.index)
      .replace(/^\d{2}\/\d{2}\/\d{2}\s+/, "")
      .trim();
    if (wrap) narration = `${narration} ${wrap}`.trim();

    const externalRef = extractHdfcExternalRef(refRaw);
    const deltaMinor = previousBalanceMinor == null ? null : balanceMinor - previousBalanceMinor;
    const type = deltaMinor == null || deltaMinor === 0 ? "expense" : deltaMinor > 0 ? "income" : "expense";

    parsedRows.push({
      occurredOn: parseHdfcPdfDate(dateRaw),
      amountMinor,
      type,
      merchant: merchantFromHdfcDescription(narration),
      externalRef,
      balanceMinor,
      sortOrder: parsedRows.length + 1,
    });

    previousBalanceMinor = balanceMinor;
  }

  return { rows: parsedRows, metadata };
}
