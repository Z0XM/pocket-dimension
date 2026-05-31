import { formatMoney } from "$lib/finance/money";
import type { ImportRow } from "$lib/importers/types";
import { toCsv } from "$lib/server/csv";

export type ImportIssue = {
  row: number;
  status: "skipped" | "rejected";
  reason: string;
  occurredOn?: string;
  amountMinor?: number;
  type?: string;
  merchant?: string;
  externalRef?: string;
  notes?: string;
};

const REPORT_COLUMNS = ["row", "status", "reason", "occurredOn", "type", "amount", "merchant", "externalRef", "notes"] as const;

export function importIssueFromRow(rowNumber: number, status: ImportIssue["status"], reason: string, row?: ImportRow): ImportIssue {
  return {
    row: rowNumber,
    status,
    reason,
    occurredOn: row?.occurredOn,
    amountMinor: row?.amountMinor,
    type: row?.type,
    merchant: row?.merchant,
    externalRef: row?.externalRef,
    notes: row?.notes,
  };
}

export function buildImportReportCsv(issues: ImportIssue[]): string {
  return toCsv(
    issues.map((issue) => ({
      row: String(issue.row),
      status: issue.status,
      reason: issue.reason,
      occurredOn: issue.occurredOn ?? "",
      type: issue.type ?? "",
      amount: issue.amountMinor != null ? formatMoney(issue.amountMinor, "INR") : "",
      merchant: issue.merchant ?? "",
      externalRef: issue.externalRef ?? "",
      notes: issue.notes ?? "",
    })),
    [...REPORT_COLUMNS]
  );
}
