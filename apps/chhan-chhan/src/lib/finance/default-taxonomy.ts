export const REFUND_TAG_NAME = "Refund";
export const SPLIT_RETURN_TAG_NAME = "Split Return";

export type DefaultTagSeed = {
  name: string;
  colorHex: string;
  kind?: "expense" | "income" | "transfer";
};

/**
 * Sole starter taxonomy — former categories + personal tags, all as tags.
 * Users may delete or rename any of these.
 */
export const DEFAULT_TAGS: readonly DefaultTagSeed[] = [
  { name: "Food", kind: "expense", colorHex: "#E85D4C" },
  { name: "Fuel", kind: "expense", colorHex: "#C97816" },
  { name: "Fun", kind: "expense", colorHex: "#DB2777" },
  { name: "Lend", kind: "expense", colorHex: "#7C3AED" },
  { name: "Medicine", kind: "expense", colorHex: "#0D9488" },
  { name: "Miscellaneous", kind: "expense", colorHex: "#475569" },
  { name: "Monthly Bill", kind: "expense", colorHex: "#2F6FED" },
  { name: "Rent", kind: "expense", colorHex: "#0F9F6E" },
  { name: "SIP", kind: "expense", colorHex: "#6965db" },
  { name: "Shopping", kind: "expense", colorHex: "#E85D4C" },
  { name: "Travel", kind: "expense", colorHex: "#2F6FED" },
  { name: "Yearly Bill", kind: "expense", colorHex: "#7C3AED" },
  { name: "Income", kind: "income", colorHex: "#0F9F6E" },
  { name: REFUND_TAG_NAME, kind: "income", colorHex: "#0D9488" },
  { name: SPLIT_RETURN_TAG_NAME, kind: "income", colorHex: "#C97816" },
  { name: "Personal", colorHex: "#2F6FED" },
  { name: "Family", colorHex: "#DB2777" },
  { name: "Others", colorHex: "#475569" },
] as const;

export function isRefundTagName(name: string | null | undefined) {
  return name === REFUND_TAG_NAME || name === SPLIT_RETURN_TAG_NAME;
}

export function refundTagKind(name: string | null | undefined): "refund" | "split_return" | null {
  if (name === REFUND_TAG_NAME) return "refund";
  if (name === SPLIT_RETURN_TAG_NAME) return "split_return";
  return null;
}
