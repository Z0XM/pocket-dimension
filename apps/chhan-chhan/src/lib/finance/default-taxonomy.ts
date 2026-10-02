import { REFUND_CATEGORY_NAME, SPLIT_RETURN_CATEGORY_NAME } from "$lib/finance/refunds";

export type DefaultCategorySeed = {
  name: string;
  kind: "expense" | "income" | "transfer";
  colorHex: string;
};

export type DefaultTagSeed = {
  name: string;
  colorHex: string;
};

/** Starter categories for every new finance account (matches the live Excel taxonomy). */
export const DEFAULT_CATEGORIES: readonly DefaultCategorySeed[] = [
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
  { name: REFUND_CATEGORY_NAME, kind: "income", colorHex: "#0D9488" },
  { name: SPLIT_RETURN_CATEGORY_NAME, kind: "income", colorHex: "#C97816" },
] as const;

/** Starter tags for every new finance account. */
export const DEFAULT_TAGS: readonly DefaultTagSeed[] = [
  { name: "Personal", colorHex: "#2F6FED" },
  { name: "Family", colorHex: "#DB2777" },
  { name: "Others", colorHex: "#475569" },
] as const;
