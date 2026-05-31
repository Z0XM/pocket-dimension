export type TransactionDedupInput = {
  occurredOn: string;
  amountMinor: number;
  merchant?: string | null;
  type: string;
  externalRef?: string | null;
};

export function transactionFingerprint(input: TransactionDedupInput): string {
  return `${input.occurredOn}|${input.amountMinor}|${input.merchant ?? ""}|${input.type}`;
}

/** Kotak reuses refs across related legs (deposit + fees, auth hold + reversal). */
export function transactionDedupKey(input: TransactionDedupInput): string {
  if (input.externalRef) {
    return `${input.externalRef}|${input.occurredOn}|${input.amountMinor}|${input.type}`;
  }
  return transactionFingerprint(input);
}
