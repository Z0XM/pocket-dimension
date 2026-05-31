import { db, schema } from "@pocket-dimension/db";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { buildImportReportCsv, importIssueFromRow, type ImportIssue } from "$lib/importers/import-report";
import { transactionDedupKey } from "$lib/importers/transaction-dedup";
import type { ImportResult, ImportRow } from "$lib/importers/types";
import { isBalanceSnapshotNewer, latestBalanceFromRows } from "$lib/server/balance";
import { csvImportRowSchema } from "$lib/validation/finance";

type ImportOptions = {
  skipDuplicates?: boolean;
  currencyCode?: string;
  onProgress?: (progress: ImportProgress) => void;
};

export type ImportProgress = {
  phase: "loading" | "importing" | "syncing";
  processed: number;
  total: number;
  accepted: number;
  skipped: number;
  rejected: number;
};

const PROGRESS_EVERY = 40;

type ParsedImportRow = {
  occurredOn: string;
  amountMinor: number;
  type: "expense" | "income" | "transfer";
  merchant?: string;
  notes?: string;
  externalRef?: string;
  balanceMinor?: number;
  sortOrder?: number;
};

function duplicateSkipReason(row: ParsedImportRow, existingKeys: Set<string>): string | null {
  const key = transactionDedupKey(row);
  if (!existingKeys.has(key)) return null;

  if (row.externalRef) {
    return "Duplicate transaction (same reference, date, amount, and type)";
  }

  return "Duplicate transaction with no reference (same date, amount, merchant, and type)";
}

function dedupKeyWhere(accountId: string, row: ParsedImportRow) {
  if (row.externalRef) {
    return and(
      eq(schema.financeTransactions.accountId, accountId),
      eq(schema.financeTransactions.externalRef, row.externalRef),
      eq(schema.financeTransactions.occurredOn, row.occurredOn),
      eq(schema.financeTransactions.amountMinor, row.amountMinor),
      eq(schema.financeTransactions.type, row.type)
    );
  }

  return fingerprintWhere(accountId, row);
}

function fingerprintWhere(accountId: string, row: ParsedImportRow) {
  return and(
    eq(schema.financeTransactions.accountId, accountId),
    eq(schema.financeTransactions.occurredOn, row.occurredOn),
    eq(schema.financeTransactions.amountMinor, row.amountMinor),
    eq(schema.financeTransactions.type, row.type),
    row.merchant
      ? eq(schema.financeTransactions.merchant, row.merchant)
      : or(isNull(schema.financeTransactions.merchant), eq(schema.financeTransactions.merchant, ""))
  );
}

async function syncImportRowBalance(userId: string, accountId: string, row: ParsedImportRow) {
  if (row.balanceMinor == null) return;

  const balanceUpdate = {
    balanceMinor: row.balanceMinor,
    sortOrder: row.sortOrder ?? undefined,
    updatedById: userId,
    ...(row.externalRef ? { externalRef: row.externalRef } : {}),
  };

  if (row.externalRef) {
    const updated = await db
      .update(schema.financeTransactions)
      .set(balanceUpdate)
      .where(dedupKeyWhere(accountId, row))
      .returning({ id: schema.financeTransactions.id });

    if (updated.length > 0) return;
  }

  await db.update(schema.financeTransactions).set(balanceUpdate).where(fingerprintWhere(accountId, row));
}

async function syncImportBalances(userId: string, accountId: string, rows: ImportRow[]) {
  for (const row of rows) {
    const parsed = csvImportRowSchema.safeParse(row);
    if (!parsed.success) continue;
    await syncImportRowBalance(userId, accountId, parsed.data);
  }

  const latest = latestBalanceFromRows(rows);
  if (!latest) return;

  const account = await db.query.financeAccounts.findFirst({
    where: eq(schema.financeAccounts.id, accountId),
    columns: { balanceMinor: true, balanceAsOf: true },
  });

  const current =
    account?.balanceMinor != null && account.balanceAsOf
      ? {
          balanceMinor: account.balanceMinor,
          asOf: account.balanceAsOf,
          sortOrder: 0,
        }
      : null;

  if (!isBalanceSnapshotNewer(latest, current)) return;

  await db
    .update(schema.financeAccounts)
    .set({
      balanceMinor: latest.balanceMinor,
      balanceAsOf: latest.asOf,
      updatedById: userId,
    })
    .where(eq(schema.financeAccounts.id, accountId));
}

export async function importTransactionRows(
  userId: string,
  accountId: string,
  rows: ImportRow[],
  options: ImportOptions = {}
): Promise<ImportResult> {
  const currencyCode = options.currencyCode ?? "INR";
  const skipDuplicates = options.skipDuplicates ?? true;
  const onProgress = options.onProgress;

  const existingKeys = new Set<string>();

  if (skipDuplicates) {
    onProgress?.({
      phase: "loading",
      processed: 0,
      total: rows.length,
      accepted: 0,
      skipped: 0,
      rejected: 0,
    });

    const existing = await db
      .select({
        externalRef: schema.financeTransactions.externalRef,
        occurredOn: schema.financeTransactions.occurredOn,
        amountMinor: schema.financeTransactions.amountMinor,
        merchant: schema.financeTransactions.merchant,
        type: schema.financeTransactions.type,
      })
      .from(schema.financeTransactions)
      .where(eq(schema.financeTransactions.accountId, accountId));

    for (const row of existing) {
      existingKeys.add(transactionDedupKey(row));
    }
  }

  let accepted = 0;
  let rejected = 0;
  let skipped = 0;
  const rejectionReasons: ImportResult["rejectionReasons"] = [];
  const issues: ImportIssue[] = [];

  const reportProgress = (index: number) => {
    if (!onProgress) return;
    if (index % PROGRESS_EVERY !== 0 && index !== rows.length - 1) return;
    onProgress({
      phase: "importing",
      processed: index + 1,
      total: rows.length,
      accepted,
      skipped,
      rejected,
    });
  };

  for (const [index, row] of rows.entries()) {
    const parsed = csvImportRowSchema.safeParse(row);
    if (!parsed.success) {
      rejected += 1;
      const reason = parsed.error.issues[0]?.message ?? "Invalid row";
      rejectionReasons.push({ row: index + 1, reason });
      issues.push(importIssueFromRow(index + 1, "rejected", reason, row));
      reportProgress(index);
      continue;
    }

    const skipReason = skipDuplicates ? duplicateSkipReason(parsed.data, existingKeys) : null;

    if (skipReason) {
      skipped += 1;
      issues.push(importIssueFromRow(index + 1, "skipped", skipReason, row));
      reportProgress(index);
      continue;
    }

    await db.insert(schema.financeTransactions).values({
      accountId,
      occurredOn: parsed.data.occurredOn,
      amountMinor: parsed.data.amountMinor,
      currencyCode,
      type: parsed.data.type,
      merchant: parsed.data.merchant,
      notes: parsed.data.notes,
      externalRef: parsed.data.externalRef,
      balanceMinor: parsed.data.balanceMinor,
      sortOrder: parsed.data.sortOrder ?? 0,
      createdById: userId,
      updatedById: userId,
    });

    existingKeys.add(transactionDedupKey(parsed.data));
    accepted += 1;
    reportProgress(index);
  }

  onProgress?.({
    phase: "syncing",
    processed: rows.length,
    total: rows.length,
    accepted,
    skipped,
    rejected,
  });

  await syncImportBalances(userId, accountId, rows);

  return {
    totalRows: rows.length,
    accepted,
    rejected,
    skipped,
    rejectionReasons,
    issues,
    reportCsv: issues.length ? buildImportReportCsv(issues) : undefined,
  };
}

export async function resetAccountTransactions(accountId: string): Promise<number> {
  const result = await db
    .delete(schema.financeTransactions)
    .where(eq(schema.financeTransactions.accountId, accountId))
    .returning({ id: schema.financeTransactions.id });

  await db.update(schema.financeAccounts).set({ balanceMinor: null, balanceAsOf: null }).where(eq(schema.financeAccounts.id, accountId));

  return result.length;
}

export async function dedupeAccountTransactions(accountId: string): Promise<{ deleted: number; remaining: number }> {
  const result = await db.execute(sql`
    with ranked as (
      select
        id,
        row_number() over (
          partition by
            account_id,
            case
              when external_ref is not null then
                external_ref || '|' || occurred_on::text || '|' || amount_minor || '|' || type
              else
                occurred_on::text || '|' || amount_minor || '|' || coalesce(merchant, '') || '|' || type
            end
          order by
            (external_ref is not null)::int desc,
            (balance_minor is not null)::int desc,
            created_at asc
        ) as rn
      from chhanchhan.finance_transactions
      where account_id = ${accountId}
    ),
    removed as (
      delete from chhanchhan.finance_transactions t
      using ranked r
      where t.id = r.id and r.rn > 1
      returning t.id
    )
    select
      (select count(*)::int from removed) as deleted,
      (select count(*)::int from chhanchhan.finance_transactions where account_id = ${accountId}) as remaining
  `);

  const row = result.rows[0] as { deleted: number; remaining: number } | undefined;
  return {
    deleted: row?.deleted ?? 0,
    remaining: row?.remaining ?? 0,
  };
}
