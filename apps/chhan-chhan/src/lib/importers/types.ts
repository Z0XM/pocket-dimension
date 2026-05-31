export type ImportRow = {
  occurredOn: string;
  amountMinor: number;
  type: "expense" | "income" | "transfer";
  merchant?: string;
  notes?: string;
  externalRef?: string;
  balanceMinor?: number;
  sortOrder?: number;
};

export type ImportResult = {
  totalRows: number;
  accepted: number;
  rejected: number;
  skipped: number;
  rejectionReasons: Array<{ row: number; reason: string }>;
  issues: Array<{
    row: number;
    status: "skipped" | "rejected";
    reason: string;
    occurredOn?: string;
    amountMinor?: number;
    type?: string;
    merchant?: string;
    externalRef?: string;
    notes?: string;
  }>;
  reportCsv?: string;
  metadata?: Record<string, string>;
};

export type StatementInput = {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
};

export type BankImporter = {
  id: string;
  label: string;
  accept: string;
  parse: (input: StatementInput) => Promise<{ rows: ImportRow[]; metadata: Record<string, string> }>;
};
