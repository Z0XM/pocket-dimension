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
  /** Account balance after this import completed (when available). */
  resultingBalance?: {
    balanceMinor: number;
    asOf: string;
    source: "statement" | "unchanged";
  } | null;
};

export type ImportPreviewRowStatus = "will_import" | "duplicate" | "invalid" | "warning";

export type ImportClassificationSuggestion = {
  categoryId: string | null;
  categoryName: string | null;
  tagIds: string[];
  tagNames: string[];
  source: "exact" | "fuzzy";
  matchedMerchant: string;
  sampleCount: number;
};

export type ImportPreviewRow = {
  row: number;
  status: ImportPreviewRowStatus;
  reasons: string[];
  occurredOn?: string;
  amountMinor?: number;
  type?: string;
  merchant?: string;
  externalRef?: string;
  notes?: string;
  balanceMinor?: number;
  sortOrder?: number;
  suggestion?: ImportClassificationSuggestion | null;
};

export type ImportPreviewTaxonomy = {
  categories: Array<{
    id: string;
    name: string;
    kind: "expense" | "income" | "transfer";
    colorHex: string | null;
  }>;
  tags: Array<{
    id: string;
    name: string;
    colorHex: string | null;
  }>;
};

export type ImportPreview = {
  totalRows: number;
  willImport: number;
  duplicates: number;
  invalid: number;
  warnings: number;
  rows: ImportPreviewRow[];
  currentBalance: {
    balanceMinor: number;
    asOf: string;
  } | null;
  projectedBalance: {
    balanceMinor: number;
    asOf: string;
    willUpdateAccount: boolean;
  } | null;
  metadata: Record<string, string>;
  importerId: string;
  fileName: string;
  taxonomy: ImportPreviewTaxonomy;
};

export type ImportRowAssignment = {
  categoryId?: string | null;
  tagIds?: string[];
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
