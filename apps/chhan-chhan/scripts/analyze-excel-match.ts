import XLSX from "/tmp/node_modules/xlsx";
import { db, schema } from "@pocket-dimension/db";
import { eq } from "drizzle-orm";

const accountId = "019cb9bd-c1ea-7b7f-a9ae-8fa66448705c";

function excelDate(value: number) {
  const parsed = XLSX.SSF.parse_date_code(value);
  return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
}

type ExcelRow = {
  date: string;
  amountMinor: number;
  type: "income" | "expense";
  category: string | null;
  sub: string | null;
  notes: string | null;
  groups: string | null;
  index: number;
};

const workbook = XLSX.readFile("data/Finance.xlsx");
const excel: ExcelRow[] = XLSX.utils
  .sheet_to_json<Record<string, unknown>>(workbook.Sheets.Main, { defval: null })
  .filter((row) => row.Date && row["Amount (39050.57)"] != null && Number(row["Amount (39050.57)"]) !== 0)
  .map((row) => {
    const amount = Number(row["Amount (39050.57)"]);
    return {
      date: excelDate(Number(row.Date)),
      amountMinor: Math.round(Math.abs(amount) * 100),
      type: (amount >= 0 ? "income" : "expense") as "income" | "expense",
      category: row.Category ? String(row.Category) : null,
      sub: row["Sub Category"] ? String(row["Sub Category"]) : null,
      notes: row.Notes ? String(row.Notes).trim() : null,
      groups: row.Groups ? String(row.Groups).trim() : null,
      index: Number(row.Index),
    };
  });

const dbRows = await db
  .select({
    id: schema.financeTransactions.id,
    occurredOn: schema.financeTransactions.occurredOn,
    amountMinor: schema.financeTransactions.amountMinor,
    type: schema.financeTransactions.type,
    merchant: schema.financeTransactions.merchant,
    notes: schema.financeTransactions.notes,
    sortOrder: schema.financeTransactions.sortOrder,
  })
  .from(schema.financeTransactions)
  .where(eq(schema.financeTransactions.accountId, accountId));

function key(date: string, amountMinor: number, type: string) {
  return `${date}|${amountMinor}|${type}`;
}

const dbByKey = new Map<string, typeof dbRows>();
for (const row of dbRows) {
  const k = key(row.occurredOn, row.amountMinor, row.type);
  const entry = dbByKey.get(k) ?? [];
  entry.push(row);
  dbByKey.set(k, entry);
}

const excelByKey = new Map<string, ExcelRow[]>();
for (const row of excel) {
  const k = key(row.date, row.amountMinor, row.type);
  const entry = excelByKey.get(k) ?? [];
  entry.push(row);
  excelByKey.set(k, entry);
}

function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function noteMatchesMerchant(notes: string | null, merchant: string | null) {
  if (!notes || !merchant) return false;
  const n = norm(notes);
  const m = norm(merchant);
  return n.length >= 3 && (m.includes(n) || n.includes(m) || n.split(" ").some((w) => w.length >= 4 && m.includes(w)));
}

let high = 0;
let medium = 0;
let skipped = 0;

for (const [k, excelRows] of excelByKey) {
  const dbMatches = dbByKey.get(k);
  if (!dbMatches) {
    skipped += excelRows.length;
    continue;
  }
  if (excelRows.length === 1 && dbMatches.length === 1) {
    high++;
    continue;
  }

  const usedDb = new Set<string>();
  for (const er of excelRows.sort((a, b) => a.index - b.index)) {
    const candidates = dbMatches.filter((d) => !usedDb.has(d.id));
    if (candidates.length === 1) {
      medium++;
      usedDb.add(candidates[0].id);
      continue;
    }
    const byNote = candidates.filter((d) => noteMatchesMerchant(er.notes, d.merchant));
    if (byNote.length === 1) {
      medium++;
      usedDb.add(byNote[0].id);
      continue;
    }
    skipped++;
    if (skipped <= 10) {
      console.log(
        "ambiguous",
        k,
        er.notes,
        "candidates",
        candidates.map((c) => c.merchant)
      );
    }
  }
}

console.log({ high, medium, skipped });
