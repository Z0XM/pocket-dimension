/** HDFC NetBanking PDF dates are DD/MM/YY (or DD/MM/YYYY in headers). */
export function parseHdfcPdfDate(raw: string): string {
  const match = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (!match) throw new Error(`Invalid HDFC date: ${raw}`);

  const [, dd, mm, yearRaw] = match;
  const month = Number(mm);
  const day = Number(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error(`Invalid HDFC date: ${raw}`);
  }

  const yyyy = yearRaw.length === 4 ? yearRaw : `20${yearRaw}`;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * HDFC UPI narrations use hyphens: `UPI-MERCHANT-vpa@bank-...`
 * Autopay: `UPI-AUTOPAY-MERCHANT-...`
 */
export function merchantFromHdfcDescription(description: string): string {
  const desc = description.trim();
  if (!desc) return "Unknown";

  const upi = desc.match(/^UPI-(?:AUTOPAY-)?(.+)$/i);
  if (upi) {
    const rest = upi[1];
    // Prefer text before the VPA (`name@handle`); PDF wraps may insert spaces mid-token.
    const beforeVpa = rest.match(/^(.+?)(?=-[A-Za-z0-9._]*\s*[A-Za-z0-9._]*@[A-Za-z0-9._]+)/);
    let merchant = (beforeVpa?.[1] ?? rest.split("-")[0] ?? rest).trim();
    // HDFC sometimes repeats a single-token payee: `AIRTEL-AIRTEL-vpa@...`
    if (!/\s/.test(merchant) && merchant.includes("-")) {
      merchant = merchant.split("-")[0] ?? merchant;
    }
    return merchant || rest;
  }

  const ach = desc.match(/^ACH\s+[DC]-\s*(.+)$/i);
  if (ach) {
    return ach[1].replace(/-[A-Z0-9]{6,}$/i, "").trim() || ach[1].trim();
  }

  return desc;
}

/** Chq./Ref.No. column — typically 10–16 digit numeric refs. */
export function extractHdfcExternalRef(refRaw: string): string | undefined {
  const cleaned = refRaw.trim();
  if (!/^\d{10,}$/.test(cleaned)) return undefined;
  return cleaned;
}

/** HDFC PDFs repeat account headers and append a statement summary / disclaimer. */
export function stripHdfcPdfChunkFooter(chunk: string): string {
  const footerPatterns = [
    /\sSTATEMENT SUMMARY/i,
    /\sGenerated On:/i,
    /\sPage No\s*\.:/i,
    /\sStatement of account\s*From\s*:/i,
    /\sHDFC BANK LIMITED/i,
    /\sHDFC BANK LTD\b/i,
    /\sThis is a computer generated statement/i,
    /\s\*Closing balance includes/i,
    /\sContents of this statement will be considered correct/i,
    /\sRegistered Office Address:/i,
    /\sDate Narration Chq\.\/Ref\.No\./i,
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

export function extractHdfcMetadata(text: string): Record<string, string> {
  const metadata: Record<string, string> = {};

  const accountMatch = text.match(/Account No\s*:\s*(\d+)/i);
  if (accountMatch) metadata.accountNumber = accountMatch[1];

  const periodMatch = text.match(/Statement of account\s*From\s*:\s*(\d{2}\/\d{2}\/\d{4})\s*To\s*:\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (periodMatch) {
    metadata.period = `${periodMatch[1]} - ${periodMatch[2]}`;
  }

  const ifscMatch = text.match(/RTGS\/NEFT IFSC:\s*([A-Z0-9]+)/i);
  if (ifscMatch) metadata.ifsc = ifscMatch[1];

  const openingMatch = text.match(/STATEMENT SUMMARY\s*:-?\s*Opening Balance[\s\S]*?([\d,]+\.\d{2})\s+\d+\s+\d+\s+([\d,]+\.\d{2})/i);
  if (openingMatch) metadata.openingBalance = openingMatch[1];

  return metadata;
}
