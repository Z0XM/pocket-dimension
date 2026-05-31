const MONTHS: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

export function parseKotakCsvDate(raw: string): string {
  const datePart = raw.trim().split(/\s+/)[0];
  const [dd, mm, yyyy] = datePart.split("-");
  if (!dd || !mm || !yyyy) throw new Error(`Invalid date: ${raw}`);
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

export function parseKotakPdfDate(raw: string): string {
  const [dd, mon, yyyy] = raw.trim().split(/\s+/);
  const mm = MONTHS[mon];
  if (!dd || !mm || !yyyy) throw new Error(`Invalid date: ${raw}`);
  return `${yyyy}-${mm}-${dd.padStart(2, "0")}`;
}

export function merchantFromDescription(description: string): string {
  const desc = description.trim();
  if (!desc) return "Unknown";

  if (desc.startsWith("UPI/")) {
    return desc.split("/")[1]?.trim() || desc;
  }

  if (desc.startsWith("PCD/") || desc.startsWith("PCI/")) {
    return desc.split("/")[2]?.trim() || desc;
  }

  if (desc.startsWith("ATW/")) {
    return "ATM Withdrawal";
  }

  if (desc.startsWith("Int.Pd:")) {
    return "Interest";
  }

  if (/^CASHBACK EARNED/i.test(desc)) {
    return "CASHBACK EARNED";
  }

  const neftMatch = desc.match(/^NEFT\s+\S+\s+(.+)$/i);
  if (neftMatch) return neftMatch[1].trim();

  return desc;
}

/** Kotak puts refs in CSV columns or at the end of PDF description lines. */
const KOTAK_EXTERNAL_REF = /\s((?:UPI-\d+|IMPS-\d+|NEFTINW-\d+|ONBF-\s*[a-z0-9]+|\d{10,15}))\s*$/i;

function normalizeKotakExternalRef(raw: string): string {
  if (/^ONBF-/i.test(raw)) {
    return `ONBF-${raw.replace(/^ONBF-\s*/i, "").toLowerCase()}`;
  }
  if (/^(UPI-|IMPS-|NEFTINW-)/i.test(raw)) {
    return raw.toUpperCase();
  }
  return raw;
}

export function extractKotakExternalRef(description: string): {
  externalRef?: string;
  body: string;
} {
  const refMatch = description.match(KOTAK_EXTERNAL_REF);
  if (!refMatch) return { body: description };

  return {
    externalRef: normalizeKotakExternalRef(refMatch[1]),
    body: description.slice(0, refMatch.index).trim(),
  };
}

/** Kotak PDFs append page footers after the last txn on each page. */
export function stripKotakPdfChunkFooter(chunk: string): string {
  const footerPatterns = [
    /\sStatement Generated on/i,
    /\sPage \d+ of\d+/i,
    /\sSavings Account Transactions/i,
    /\sMUKUL SINGH Account No\./i,
    /\sAccount Statement \d/i,
  ];

  let end = chunk.length;
  for (const pattern of footerPatterns) {
    const match = chunk.match(pattern);
    if (match?.index != null && match.index > 0) {
      end = Math.min(end, match.index);
    }
  }

  return chunk.slice(0, end).trim();
}

export function extractKotakMetadata(text: string): Record<string, string> {
  const metadata: Record<string, string> = {};
  const accountMatch = text.match(/Account No\.?\s*(\d+)/i);
  if (accountMatch) metadata.accountNumber = accountMatch[1];

  const periodMatch = text.match(/Account Statement\s+([\d\s\w-]+?\d{4})\s*-\s*([\d\s\w-]+?\d{4})/i);
  if (periodMatch) metadata.period = `${periodMatch[1].trim()} - ${periodMatch[2].trim()}`;

  const ifscMatch = text.match(/IFSC(?: Code)?\s*([A-Z0-9]+)/i);
  if (ifscMatch) metadata.ifsc = ifscMatch[1];

  const currencyMatch = text.match(/Currency\s+([A-Z\s]+?)(?:\s+Savings|\s+MICR|$)/i);
  if (currencyMatch) metadata.currency = currencyMatch[1].trim();

  return metadata;
}
