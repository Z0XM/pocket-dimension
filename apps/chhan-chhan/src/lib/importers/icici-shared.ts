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

export function parseIciciPdfDate(raw: string): string {
  const dotted = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dotted) {
    return `${dotted[3]}-${dotted[2]}-${dotted[1]}`;
  }

  const parts = raw.trim().split(/\s+/);
  if (parts.length === 3 && MONTHS[parts[1]]) {
    return `${parts[2]}-${MONTHS[parts[1]]}-${parts[0].padStart(2, "0")}`;
  }

  throw new Error(`Invalid ICICI date: ${raw}`);
}

export function iciciDescriptionFromBody(body: string): string {
  const match = body.match(
    /\b(UPI|NEFT|IMPS|INF|INFT|ATM|BIL|ONL|VPS|IPS|EBA|NECS|RTGS|CMS|BPAY|RCHG|TOP|MMT|PAYC|CCWD|LNPY|PAVC|PAC|VAT|MAT|NFS|SMO|BCTT|SGB|DTAX|IDTX|BBPS)\//
  );
  if (match?.index != null) {
    return body.slice(match.index).trim();
  }
  return body.trim();
}

export function extractIciciExternalRef(description: string): {
  externalRef?: string;
  body: string;
} {
  const pathRef = description.match(/\/(\d{12,15})\//);
  if (pathRef) {
    return { externalRef: pathRef[1], body: description };
  }

  const pytmRef = description.match(/\b(PYTM[A-Z0-9]+)\b/i);
  if (pytmRef) {
    return { externalRef: pytmRef[1].toUpperCase(), body: description };
  }

  const yjpRef = description.match(/\b(YJP[a-f0-9]{16,})\b/i);
  if (yjpRef) {
    return { externalRef: yjpRef[1], body: description };
  }

  return { body: description };
}

/** ICICI PDFs repeat headers and append address blocks between pages. */
export function stripIciciPdfChunkFooter(chunk: string): string {
  const footerPatterns = [
    /\sICICI BANK LTD-/i,
    /\sStatement of Transactions in Saving Account/i,
    /\sYour Base Branch:/i,
    /\sSincerly, Team ICICI Bank/i,
    /\sLegends for transactions/i,
    /\sThis is a system generated statement/i,
    /\swww\.icici\.bank\.in/i,
    /\sNever share your OTP/i,
    /\sDial your Bank/i,
    /\sPlease call from your registered mobile/i,
    /\sRCHG\s-/i,
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

export function extractIciciMetadata(text: string): Record<string, string> {
  const metadata: Record<string, string> = {};

  const accountMatch = text.match(/Saving Account no\.\s*(\d+)/i);
  if (accountMatch) metadata.accountNumber = accountMatch[1];

  const periodMatch = text.match(/for the period\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})\s*-\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
  if (periodMatch) {
    metadata.period = `${periodMatch[1].trim()} - ${periodMatch[2].trim()}`;
  }

  return metadata;
}
