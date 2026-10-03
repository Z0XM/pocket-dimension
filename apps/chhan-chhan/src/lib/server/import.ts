import { db, schema } from "@pocket-dimension/db";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { buildImportReportCsv, importIssueFromRow, type ImportIssue } from "$lib/importers/import-report";
import { transactionDedupKey } from "$lib/importers/transaction-dedup";
import type { ImportPreview, ImportPreviewRow, ImportResult, ImportRow, ImportRowAssignment } from "$lib/importers/types";
import { isBalanceSnapshotNewer, latestBalanceFromRows } from "$lib/server/balance";
import { getCurrentBalance } from "$lib/server/finance";
import { enrichPreviewRowsWithSuggestions, loadImportTaxonomy, resolveImportAssignments } from "$lib/server/import-suggestions";
import { csvImportRowSchema } from "$lib/validation/finance";

type ImportOptions = {
  skipDuplicates?: boolean;
  currencyCode?: string;
  onProgress?: (progress: ImportProgress) => void;
  /** Per-row tag overrides keyed by 1-based statement row number. */
  assignments?: Record<string, ImportRowAssignment>;
};

type PreviewOptions = {
  skipDuplicates?: boolean;
  metadata?: Record<string, string>;
  importerId?: string;
  fileName?: string;
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

function balanceChainIssue(prev: ParsedImportRow, next: ParsedImportRow): string | null {
  if (prev.balanceMinor == null || next.balanceMinor == null) return null;

  const expected = next.type === "income" ? prev.balanceMinor + next.amountMinor : prev.balanceMinor - next.amountMinor;

  if (expected === next.balanceMinor) return null;

  const gapMinor = next.balanceMinor - expected;
  return `Balance chain break vs previous row (expected ${expected}, got ${next.balanceMinor}, gap ${gapMinor})`;
}

async function loadExistingDedupKeys(accountId: string): Promise<Set<string>> {
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

  const keys = new Set<string>();
  for (const row of existing) {
    keys.add(transactionDedupKey(row));
  }
  return keys;
}

/** Classify parsed rows without writing. Used for pre-import confirmation. */
export async function previewImportRows(accountId: string, rows: ImportRow[], options: PreviewOptions = {}): Promise<ImportPreview> {
  const skipDuplicates = options.skipDuplicates ?? true;
  const onProgress = options.onProgress;

  onProgress?.({
    phase: "loading",
    processed: 0,
    total: rows.length,
    accepted: 0,
    skipped: 0,
    rejected: 0,
  });

  const existingKeys = skipDuplicates ? await loadExistingDedupKeys(accountId) : new Set<string>();
  const seenInFile = new Set<string>();
  const previewRows: ImportPreviewRow[] = [];

  let willImport = 0;
  let duplicates = 0;
  let invalid = 0;

  const validParsed: Array<{ index: number; data: ParsedImportRow }> = [];

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 1;
    const parsed = csvImportRowSchema.safeParse(row);

    if (!parsed.success) {
      invalid += 1;
      previewRows.push({
        row: rowNumber,
        status: "invalid",
        reasons: [parsed.error.issues[0]?.message ?? "Invalid row"],
        occurredOn: row.occurredOn,
        amountMinor: row.amountMinor,
        type: row.type,
        merchant: row.merchant,
        externalRef: row.externalRef,
        notes: row.notes,
        balanceMinor: row.balanceMinor,
        sortOrder: row.sortOrder,
      });
      onProgress?.({
        phase: "importing",
        processed: rowNumber,
        total: rows.length,
        accepted: willImport,
        skipped: duplicates,
        rejected: invalid,
      });
      continue;
    }

    const reasons: string[] = [];
    const key = transactionDedupKey(parsed.data);
    const dbDup = skipDuplicates ? duplicateSkipReason(parsed.data, existingKeys) : null;
    const fileDup = seenInFile.has(key);

    if (dbDup) {
      reasons.push(dbDup);
    }
    if (fileDup) {
      reasons.push("Duplicate within this statement file");
    }
    if (parsed.data.balanceMinor == null) {
      reasons.push("Missing statement balance on this row");
    }
    if (!parsed.data.externalRef) {
      reasons.push("Missing reference — dedup uses date/amount/merchant only");
    }
    if (parsed.data.amountMinor <= 0) {
      reasons.push("Amount is missing or not positive");
    }

    seenInFile.add(key);

    if (dbDup || fileDup) {
      duplicates += 1;
      previewRows.push({
        row: rowNumber,
        status: "duplicate",
        reasons,
        occurredOn: parsed.data.occurredOn,
        amountMinor: parsed.data.amountMinor,
        type: parsed.data.type,
        merchant: parsed.data.merchant,
        externalRef: parsed.data.externalRef,
        notes: parsed.data.notes,
        balanceMinor: parsed.data.balanceMinor,
        sortOrder: parsed.data.sortOrder,
      });
    } else {
      willImport += 1;
      const hasSoftWarning = reasons.length > 0;
      previewRows.push({
        row: rowNumber,
        status: hasSoftWarning ? "warning" : "will_import",
        reasons,
        occurredOn: parsed.data.occurredOn,
        amountMinor: parsed.data.amountMinor,
        type: parsed.data.type,
        merchant: parsed.data.merchant,
        externalRef: parsed.data.externalRef,
        notes: parsed.data.notes,
        balanceMinor: parsed.data.balanceMinor,
        sortOrder: parsed.data.sortOrder,
      });
      validParsed.push({ index, data: parsed.data });
    }

    onProgress?.({
      phase: "importing",
      processed: rowNumber,
      total: rows.length,
      accepted: willImport,
      skipped: duplicates,
      rejected: invalid,
    });
  }

  // Balance-chain checks on statement order (sortOrder, then date)
  const chainOrder = [...validParsed].sort((a, b) => {
    const sortA = a.data.sortOrder ?? 0;
    const sortB = b.data.sortOrder ?? 0;
    if (sortA !== sortB) return sortA - sortB;
    return a.data.occurredOn.localeCompare(b.data.occurredOn);
  });

  for (let i = 1; i < chainOrder.length; i++) {
    const prev = chainOrder[i - 1]!.data;
    const next = chainOrder[i]!.data;
    const issue = balanceChainIssue(prev, next);
    if (!issue) continue;

    const preview = previewRows[chainOrder[i]!.index]!;
    if (!preview.reasons.includes(issue)) {
      preview.reasons.push(issue);
    }
    if (preview.status === "will_import") {
      preview.status = "warning";
    }
  }

  // Also flag sort-order gaps among rows that carry sortOrder
  const withSort = chainOrder.filter((r) => r.data.sortOrder != null);
  for (let i = 1; i < withSort.length; i++) {
    const prevSort = withSort[i - 1]!.data.sortOrder!;
    const nextSort = withSort[i]!.data.sortOrder!;
    if (nextSort === prevSort + 1) continue;
    if (nextSort <= prevSort) continue;
    const gap = nextSort - prevSort - 1;
    if (gap <= 0) continue;
    const preview = previewRows[withSort[i]!.index]!;
    const msg = `Statement serial gap: jumped from ${prevSort} to ${nextSort} (${gap} missing)`;
    if (!preview.reasons.includes(msg)) {
      preview.reasons.push(msg);
    }
    if (preview.status === "will_import") {
      preview.status = "warning";
    }
  }

  const [currentBalanceRaw, account] = await Promise.all([
    getCurrentBalance(accountId),
    db.query.financeAccounts.findFirst({
      where: eq(schema.financeAccounts.id, accountId),
      columns: { balanceMinor: true, balanceAsOf: true },
    }),
  ]);

  const currentBalance = currentBalanceRaw != null ? { balanceMinor: currentBalanceRaw.balanceMinor, asOf: currentBalanceRaw.asOf } : null;

  const statementLatest = latestBalanceFromRows(rows);
  const accountSnapshot =
    account?.balanceMinor != null && account.balanceAsOf
      ? { balanceMinor: account.balanceMinor, asOf: account.balanceAsOf, sortOrder: 0 }
      : currentBalance
        ? { balanceMinor: currentBalance.balanceMinor, asOf: currentBalance.asOf, sortOrder: 0 }
        : null;

  const projectedBalance = statementLatest
    ? {
        balanceMinor: statementLatest.balanceMinor,
        asOf: statementLatest.asOf,
        willUpdateAccount: isBalanceSnapshotNewer(statementLatest, accountSnapshot),
      }
    : null;

  onProgress?.({
    phase: "syncing",
    processed: rows.length,
    total: rows.length,
    accepted: willImport,
    skipped: duplicates,
    rejected: invalid,
  });

  await enrichPreviewRowsWithSuggestions(accountId, previewRows);
  const taxonomy = await loadImportTaxonomy(accountId);

  const warningCount = previewRows.filter((row) => row.status === "warning").length;

  return {
    totalRows: rows.length,
    willImport,
    duplicates,
    invalid,
    warnings: warningCount,
    rows: previewRows,
    currentBalance,
    projectedBalance,
    metadata: options.metadata ?? {},
    importerId: options.importerId ?? "kotak",
    fileName: options.fileName ?? "statement",
    taxonomy,
  };
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
  const assignments = await resolveImportAssignments(accountId, options.assignments);

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
    const rowNumber = index + 1;
    const parsed = csvImportRowSchema.safeParse(row);
    if (!parsed.success) {
      rejected += 1;
      const reason = parsed.error.issues[0]?.message ?? "Invalid row";
      rejectionReasons.push({ row: rowNumber, reason });
      issues.push(importIssueFromRow(rowNumber, "rejected", reason, row));
      reportProgress(index);
      continue;
    }

    const skipReason = skipDuplicates ? duplicateSkipReason(parsed.data, existingKeys) : null;

    if (skipReason) {
      skipped += 1;
      issues.push(importIssueFromRow(rowNumber, "skipped", skipReason, row));
      reportProgress(index);
      continue;
    }

    const assignment = assignments.get(rowNumber);

    const [inserted] = await db
      .insert(schema.financeTransactions)
      .values({
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
      })
      .returning({ id: schema.financeTransactions.id });

    if (inserted && assignment?.tagIds.length) {
      await db
        .insert(schema.financeTransactionTags)
        .values(assignment.tagIds.map((tagId) => ({ transactionId: inserted.id, tagId })))
        .onConflictDoNothing();
    }

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

  const resulting = await getCurrentBalance(accountId);
  const statementLatest = latestBalanceFromRows(rows);

  return {
    totalRows: rows.length,
    accepted,
    rejected,
    skipped,
    rejectionReasons,
    issues,
    reportCsv: issues.length ? buildImportReportCsv(issues) : undefined,
    resultingBalance:
      resulting != null
        ? {
            balanceMinor: resulting.balanceMinor,
            asOf: resulting.asOf,
            source:
              statementLatest && resulting.balanceMinor === statementLatest.balanceMinor && resulting.asOf === statementLatest.asOf
                ? "statement"
                : "unchanged",
          }
        : null,
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
