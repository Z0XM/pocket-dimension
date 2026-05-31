import XLSX from "/tmp/node_modules/xlsx";
import { db, schema } from "@pocket-dimension/db";
import { and, eq } from "drizzle-orm";

const accountId = process.argv[2] ?? "019cb9bd-c1ea-7b7f-a9ae-8fa66448705c";
const xlsxPath = process.argv[3] ?? "data/Finance.xlsx";
const apply = process.argv.includes("--apply");

/** Excel category names mapped to existing DB category names. Omit ambiguous names. */
const EXCEL_CATEGORY_TO_DB: Record<string, string> = {
  Food: "Food",
  Fuel: "Fuel",
  Fun: "Fun",
  Lend: "Lend",
  Medicine: "Medicine",
  Misc: "Miscellaneous",
  "Monthly Bill": "Monthly Bill",
  Rent: "Rent",
  SIP: "SIP",
  Shop: "Shopping",
  Travel: "Travel",
  "Yearly Bill": "Yearly Bill",
  Salary: "Income",
  "Split Return": "Split Return",
  Cashback: "Refund",
  "Lend Return": "Refund",
  "Tax Return": "Refund",
};

const TAG_NAMES = new Set(["Personal", "Family", "Others"]);

type ExcelRow = {
  date: string;
  amountMinor: number;
  type: "income" | "expense" | "transfer";
  category: string | null;
  sub: string | null;
  notes: string | null;
  index: number;
};

type DbRow = {
  id: string;
  occurredOn: string;
  amountMinor: number;
  type: "expense" | "income" | "transfer";
  merchant: string | null;
  notes: string | null;
  categoryId: string | null;
};

type PlannedUpdate = {
  transactionId: string;
  excelIndex: number;
  date: string;
  amountMinor: number;
  merchant: string | null;
  category: string | null;
  tag: string | null;
  notes: string | null;
  reason: string;
};

function excelDate(value: number) {
  const parsed = XLSX.SSF.parse_date_code(value);
  return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
}

function matchKey(date: string, amountMinor: number, type: string) {
  return `${date}|${amountMinor}|${type}`;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function noteMatchesMerchant(notes: string | null, merchant: string | null) {
  if (!notes || !merchant) return false;
  const note = normalizeText(notes);
  const merch = normalizeText(merchant);
  if (note.length < 3) return false;
  if (merch.includes(note) || note.includes(merch)) return true;
  return note.split(" ").some((word) => word.length >= 4 && merch.includes(word));
}

function loadExcelRows(path: string): ExcelRow[] {
  const workbook = XLSX.readFile(path);
  return XLSX.utils
    .sheet_to_json<Record<string, unknown>>(workbook.Sheets.Main, { defval: null })
    .filter((row) => row.Date && row["Amount (39050.57)"] != null && Number(row["Amount (39050.57)"]) !== 0)
    .map((row) => {
      const amount = Number(row["Amount (39050.57)"]);
      return {
        date: excelDate(Number(row.Date)),
        amountMinor: Math.round(Math.abs(amount) * 100),
        type: amount >= 0 ? "income" : "expense",
        category: row.Category ? String(row.Category).trim() : null,
        sub: row["Sub Category"] ? String(row["Sub Category"]).trim() : null,
        notes: row.Notes ? String(row.Notes).trim() : null,
        index: Number(row.Index),
      };
    });
}

function matchExcelToDb(excelRows: ExcelRow[], dbRows: DbRow[]) {
  const excelByKey = new Map<string, ExcelRow[]>();
  for (const row of excelRows) {
    const key = matchKey(row.date, row.amountMinor, row.type);
    const bucket = excelByKey.get(key) ?? [];
    bucket.push(row);
    excelByKey.set(key, bucket);
  }

  const dbByKey = new Map<string, DbRow[]>();
  for (const row of dbRows) {
    const key = matchKey(row.occurredOn, row.amountMinor, row.type);
    const bucket = dbByKey.get(key) ?? [];
    bucket.push(row);
    dbByKey.set(key, bucket);
  }

  const matches = new Map<number, DbRow>();
  const skipped: Array<{ excel: ExcelRow; reason: string }> = [];

  for (const [key, group] of excelByKey) {
    const dbMatches = [...(dbByKey.get(key) ?? [])];
    const sortedExcel = [...group].sort((a, b) => a.index - b.index);
    const usedDbIds = new Set<string>();

    for (const excelRow of sortedExcel) {
      let candidates = dbMatches.filter((row) => !usedDbIds.has(row.id));

      if (candidates.length === 0) {
        skipped.push({ excel: excelRow, reason: "no db row for date+amount+type" });
        continue;
      }

      if (candidates.length === 1) {
        matches.set(excelRow.index, candidates[0]);
        usedDbIds.add(candidates[0].id);
        continue;
      }

      const byNote = candidates.filter((row) => noteMatchesMerchant(excelRow.notes, row.merchant));
      if (byNote.length === 1) {
        matches.set(excelRow.index, byNote[0]);
        usedDbIds.add(byNote[0].id);
        continue;
      }

      if (candidates.length === sortedExcel.length) {
        const sortedDb = [...candidates].sort((a, b) => a.id.localeCompare(b.id));
        const position = sortedExcel.findIndex((row) => row.index === excelRow.index);
        if (position >= 0 && position < sortedDb.length) {
          matches.set(excelRow.index, sortedDb[position]);
          usedDbIds.add(sortedDb[position].id);
          continue;
        }
      }

      skipped.push({ excel: excelRow, reason: `ambiguous (${candidates.length} db rows)` });
    }
  }

  return { matches, skipped };
}

const account = await db.query.financeAccounts.findFirst({
  where: eq(schema.financeAccounts.id, accountId),
  columns: { id: true, name: true, ownerUserId: true },
});

if (!account) {
  console.error(`Account not found: ${accountId}`);
  process.exit(1);
}

const [excelRows, dbRows, categories, tags, existingTags] = await Promise.all([
  Promise.resolve(loadExcelRows(xlsxPath)),
  db
    .select({
      id: schema.financeTransactions.id,
      occurredOn: schema.financeTransactions.occurredOn,
      amountMinor: schema.financeTransactions.amountMinor,
      type: schema.financeTransactions.type,
      merchant: schema.financeTransactions.merchant,
      notes: schema.financeTransactions.notes,
      categoryId: schema.financeTransactions.categoryId,
    })
    .from(schema.financeTransactions)
    .where(eq(schema.financeTransactions.accountId, accountId)),
  db.select().from(schema.financeCategories).where(eq(schema.financeCategories.accountId, accountId)),
  db.select().from(schema.financeTags).where(eq(schema.financeTags.accountId, accountId)),
  db
    .select({
      transactionId: schema.financeTransactionTags.transactionId,
      tagId: schema.financeTransactionTags.tagId,
    })
    .from(schema.financeTransactionTags)
    .innerJoin(schema.financeTransactions, eq(schema.financeTransactions.id, schema.financeTransactionTags.transactionId))
    .where(eq(schema.financeTransactions.accountId, accountId)),
]);

const categoryByName = new Map(categories.map((category) => [category.name, category]));
const tagByName = new Map(tags.map((tag) => [tag.name, tag]));
const tagsByTransaction = new Map<string, Set<string>>();
for (const row of existingTags) {
  const set = tagsByTransaction.get(row.transactionId) ?? new Set();
  set.add(row.tagId);
  tagsByTransaction.set(row.transactionId, set);
}

const { matches, skipped } = matchExcelToDb(excelRows, dbRows);

const planned: PlannedUpdate[] = [];
let skippedCategory = 0;
let skippedNotes = 0;
let skippedTag = 0;

for (const excelRow of excelRows) {
  const dbRow = matches.get(excelRow.index);
  if (!dbRow) continue;

  const mappedCategoryName = excelRow.category ? EXCEL_CATEGORY_TO_DB[excelRow.category] : null;
  const category = mappedCategoryName ? categoryByName.get(mappedCategoryName) : null;

  let categoryUpdate: string | null = null;
  if (excelRow.category && !mappedCategoryName) {
    skippedCategory++;
  } else if (category && !dbRow.categoryId) {
    const categoryKind = category.kind === "transfer" ? dbRow.type : category.kind;
    if (categoryKind === dbRow.type) {
      categoryUpdate = category.name;
    } else {
      skippedCategory++;
    }
  }

  let tagUpdate: string | null = null;
  if (excelRow.sub && TAG_NAMES.has(excelRow.sub)) {
    const tag = tagByName.get(excelRow.sub);
    if (tag && !tagsByTransaction.get(dbRow.id)?.has(tag.id)) {
      tagUpdate = excelRow.sub;
    }
  } else if (excelRow.sub) {
    skippedTag++;
  }

  let notesUpdate: string | null = null;
  if (excelRow.notes && !dbRow.notes?.trim()) {
    notesUpdate = excelRow.notes;
  } else if (excelRow.notes && dbRow.notes?.trim()) {
    skippedNotes++;
  }

  if (!categoryUpdate && !tagUpdate && !notesUpdate) continue;

  planned.push({
    transactionId: dbRow.id,
    excelIndex: excelRow.index,
    date: excelRow.date,
    amountMinor: excelRow.amountMinor,
    merchant: dbRow.merchant,
    category: categoryUpdate,
    tag: tagUpdate,
    notes: notesUpdate,
    reason: "matched date+amount+type",
  });
}

console.log(`Account: ${account.name}`);
console.log(`Excel rows: ${excelRows.length}, DB rows: ${dbRows.length}`);
console.log(`Matched: ${matches.size}, Skipped unmatched/ambiguous: ${skipped.length}`);
console.log(`Planned updates: ${planned.length}`);
console.log(
  `  categories: ${planned.filter((row) => row.category).length}, tags: ${planned.filter((row) => row.tag).length}, notes: ${planned.filter((row) => row.notes).length}`
);
console.log(`Skipped category (unmapped/kind mismatch/already set): ${skippedCategory}, tag: ${skippedTag}, notes (already set): ${skippedNotes}`);

if (!apply) {
  console.log("\nDry run only. Re-run with --apply to write changes.");
  console.log("\nSample planned updates:");
  for (const row of planned.slice(0, 12)) {
    console.log(row);
  }
  if (skipped.length) {
    console.log("\nSample skipped excel rows:");
    for (const row of skipped.slice(0, 8)) {
      console.log({
        index: row.excel.index,
        date: row.excel.date,
        amountMinor: row.excel.amountMinor,
        notes: row.excel.notes,
        reason: row.reason,
      });
    }
  }
  process.exit(0);
}

let categoriesUpdated = 0;
let tagsUpdated = 0;
let notesUpdated = 0;

for (const update of planned) {
  if (update.category) {
    const category = categoryByName.get(update.category);
    if (category) {
      await db
        .update(schema.financeTransactions)
        .set({ categoryId: category.id, updatedById: account.ownerUserId })
        .where(and(eq(schema.financeTransactions.id, update.transactionId), eq(schema.financeTransactions.accountId, accountId)));
      categoriesUpdated++;
    }
  }

  if (update.tag) {
    const tag = tagByName.get(update.tag);
    if (tag) {
      await db.insert(schema.financeTransactionTags).values({ transactionId: update.transactionId, tagId: tag.id }).onConflictDoNothing();
      tagsUpdated++;
    }
  }

  if (update.notes) {
    await db
      .update(schema.financeTransactions)
      .set({ notes: update.notes, updatedById: account.ownerUserId })
      .where(and(eq(schema.financeTransactions.id, update.transactionId), eq(schema.financeTransactions.accountId, accountId)));
    notesUpdated++;
  }
}

console.log(`Applied: ${categoriesUpdated} categories, ${tagsUpdated} tags, ${notesUpdated} notes.`);
