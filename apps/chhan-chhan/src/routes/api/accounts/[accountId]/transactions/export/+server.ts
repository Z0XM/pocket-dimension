import { getMembershipOrThrow, requireUser } from "$lib/server/authz";
import { exportColumnHeader, normalizeExportColumns, type ExportColumnId } from "$lib/finance/export-columns";
import { computeSpaceRunningBalances } from "$lib/finance/space-balance";
import { toCsv } from "$lib/server/csv";
import { toSpreadsheetMl } from "$lib/server/excel";
import { listSpaceTransactions, listTransactions } from "$lib/server/finance";
import { parseSearch } from "$lib/server/http";
import { db, schema } from "@pocket-dimension/db";
import { asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

const exportQuerySchema = z.object({
  search: z.string().trim().optional(),
  tagIds: z.preprocess(
    (value) => {
      if (value == null || value === "") return undefined;
      if (Array.isArray(value)) return value;
      return String(value)
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    },
    z.array(z.union([z.string().uuid(), z.literal("untagged")])).optional()
  ),
  type: z.enum(["expense", "income", "transfer"]).optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  spaceId: z.string().uuid().optional(),
  sortBy: z.enum(["occurredOn", "amountMinor", "merchant", "type", "createdAt"]).default("occurredOn"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
  columns: z.string().trim().optional(),
  format: z.enum(["csv", "xls"]).optional(),
});

const PAGE_SIZE = 500;
const MAX_ROWS = 50_000;
const LEGACY_CSV_COLUMNS = ["occurredOn", "amountMinor", "type", "merchant", "notes", "tags", "spaces"];

function minorToMajor(minor: number) {
  return (minor / 100).toFixed(2);
}

function signedAmountMinor(type: string, amountMinor: number) {
  return type === "expense" ? -amountMinor : amountMinor;
}

function wantsFilteredExcel(query: z.infer<typeof exportQuerySchema>) {
  if (query.format === "xls") return true;
  if (query.format === "csv") return false;
  // Any ledger filter / column picker implies the new Excel download path.
  return Boolean(
    query.columns ||
      query.search ||
      query.tagIds?.length ||
      query.type ||
      query.dateFrom ||
      query.dateTo ||
      query.spaceId ||
      query.sortDirection === "asc" ||
      query.sortBy !== "occurredOn"
  );
}

async function legacyFullAccountCsv(accountId: string) {
  const rows = await db
    .select({
      id: schema.financeTransactions.id,
      occurredOn: schema.financeTransactions.occurredOn,
      amountMinor: schema.financeTransactions.amountMinor,
      type: schema.financeTransactions.type,
      merchant: schema.financeTransactions.merchant,
      notes: schema.financeTransactions.notes,
    })
    .from(schema.financeTransactions)
    .where(eq(schema.financeTransactions.accountId, accountId))
    .orderBy(schema.financeTransactions.occurredOn, schema.financeTransactions.id);

  const tagsByTransaction = new Map<string, string[]>();
  const spacesByTransaction = new Map<string, string[]>();

  if (rows.length) {
    const transactionIds = rows.map((row) => row.id);
    const [tagRows, spaceRows] = await Promise.all([
      db
        .select({ transactionId: schema.financeTransactionTags.transactionId, name: schema.financeTags.name })
        .from(schema.financeTransactionTags)
        .innerJoin(schema.financeTags, eq(schema.financeTags.id, schema.financeTransactionTags.tagId))
        .where(inArray(schema.financeTransactionTags.transactionId, transactionIds))
        .orderBy(asc(schema.financeTags.name)),
      db
        .select({ transactionId: schema.financeSpaceTransactions.transactionId, name: schema.financeSpaces.name })
        .from(schema.financeSpaceTransactions)
        .innerJoin(schema.financeSpaces, eq(schema.financeSpaces.id, schema.financeSpaceTransactions.spaceId))
        .where(inArray(schema.financeSpaceTransactions.transactionId, transactionIds))
        .orderBy(asc(schema.financeSpaces.name)),
    ]);

    for (const row of tagRows) {
      const names = tagsByTransaction.get(row.transactionId) ?? [];
      names.push(row.name);
      tagsByTransaction.set(row.transactionId, names);
    }
    for (const row of spaceRows) {
      const names = spacesByTransaction.get(row.transactionId) ?? [];
      names.push(row.name);
      spacesByTransaction.set(row.transactionId, names);
    }
  }

  return toCsv(
    rows.map((row) => ({
      occurredOn: row.occurredOn,
      amountMinor: String(row.amountMinor),
      type: row.type,
      merchant: row.merchant ?? "",
      notes: row.notes ?? "",
      tags: (tagsByTransaction.get(row.id) ?? []).join("; "),
      spaces: (spacesByTransaction.get(row.id) ?? []).join("; "),
    })),
    LEGACY_CSV_COLUMNS
  );
}

export async function GET({ locals, params, url }) {
  const user = requireUser(locals);
  await getMembershipOrThrow(user.id, params.accountId);
  const query = parseSearch(url, exportQuerySchema);

  if (!wantsFilteredExcel(query)) {
    const csv = await legacyFullAccountCsv(params.accountId);
    return new Response(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="transactions-${params.accountId}.csv"`,
      },
    });
  }

  const includeSpaceBalance = Boolean(query.spaceId);
  const columns = normalizeExportColumns(
    (query.columns ?? "date,merchant,amount,balance")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
    { includeSpaceBalance }
  );

  const rows = [];
  let pageIndex = 0;
  let hasMore = true;
  while (hasMore && rows.length < MAX_ROWS) {
    const page = await listTransactions(params.accountId, {
      pageIndex,
      pageSize: PAGE_SIZE,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      type: query.type,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      spaceId: query.spaceId,
      tagIds: query.tagIds,
      search: query.search,
    });
    rows.push(...page.rows);
    hasMore = page.hasMore;
    pageIndex += 1;
    if (page.rows.length === 0) break;
  }

  let spaceBalances: Map<string, number> | null = null;
  if (includeSpaceBalance && columns.includes("spaceBalance") && query.spaceId) {
    // Full space history (not just the filtered window) so running balance is continuous.
    const spaceRows = (await listSpaceTransactions(params.accountId, query.spaceId)) ?? [];
    spaceBalances = computeSpaceRunningBalances(spaceRows);
  }

  const sheetRows = rows.map((row) => {
    const record: Record<string, string> = {};
    for (const col of columns) {
      record[col] = cellValue(col, row, spaceBalances);
    }
    return record;
  });

  const xml = toSpreadsheetMl(
    sheetRows,
    columns.map((id) => ({ id, header: exportColumnHeader(id) }))
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(xml, {
    status: 200,
    headers: {
      "content-type": "application/vnd.ms-excel; charset=utf-8",
      "content-disposition": `attachment; filename="transactions-${stamp}.xls"`,
    },
  });
}

function cellValue(
  col: ExportColumnId,
  row: {
    occurredOn: string;
    merchant: string | null;
    amountMinor: number;
    balanceMinor: number | null;
    type: string;
    notes: string | null;
    tags: Array<{ name: string }>;
    spaces: Array<{ name: string }>;
    id: string;
  },
  spaceBalances: Map<string, number> | null
) {
  switch (col) {
    case "date":
      return row.occurredOn;
    case "merchant":
      return row.merchant ?? "";
    case "amount":
      return minorToMajor(signedAmountMinor(row.type, row.amountMinor));
    case "balance":
      return row.balanceMinor == null ? "" : minorToMajor(row.balanceMinor);
    case "tags":
      return row.tags.map((tag) => tag.name).join("; ");
    case "notes":
      return row.notes ?? "";
    case "space":
      return row.spaces.map((space) => space.name).join("; ");
    case "spaceBalance": {
      const value = spaceBalances?.get(row.id);
      return value == null ? "" : minorToMajor(value);
    }
    default:
      return "";
  }
}
