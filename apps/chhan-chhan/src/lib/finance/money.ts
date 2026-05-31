const DEFAULT_CURRENCY = "INR";

export function parseSqlMinor(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function formatMoney(minor: number | null | undefined, currency = DEFAULT_CURRENCY): string {
  const safeMinor = parseSqlMinor(minor);
  const major = safeMinor / 100;
  const sign = major < 0 ? "-" : "";
  const abs = Math.abs(major);

  if (currency === "INR") {
    return `${sign}₹${abs.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  return `${sign}${abs.toLocaleString(undefined, { style: "currency", currency })}`;
}

/** Parse Kotak / Indian bank amount strings like `2,18,198.00`. */
export function parseIndianAmount(raw: string): number {
  const cleaned = raw.replace(/,/g, "").trim();
  const rupees = Number.parseFloat(cleaned);
  if (!Number.isFinite(rupees)) {
    throw new Error(`Invalid amount: ${raw}`);
  }
  return Math.round(rupees * 100);
}
