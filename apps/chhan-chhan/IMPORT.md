# Statement import — strategies, issues, and fixes

Reference for Kotak (and future bank) imports in Chhan Chhan. Updated from real debugging sessions (2026).

---

## Pipeline overview

```
Statement file (CSV / PDF)
  → Bank importer (`getImporter(id)` in `src/lib/importers/index.ts`)
  → Parse rows (`ImportRow[]`)
  → `importTransactionRows()` (`src/lib/server/import.ts`)
  → `finance_transactions` + account balance sync
```

| Entry point | Path |
|-------------|------|
| UI (Control) | Upload → `POST /api/accounts/[id]/transactions/import` or `/import/stream` |
| CLI backfill / reset | `bun --env-file=.env scripts/dedupe-transactions.ts <account-id> [file.pdf] [--reset]` |
| Excel legacy sync | `scripts/sync-from-excel.ts` (separate; category mapping only) |
| Control clear-all | `?/clearAllTransactions` → `resetAccountTransactions()` |

### Supported importers

| ID | Label | Formats |
|----|--------|---------|
| `kotak` | Kotak Mahindra Bank | `.csv`, `.pdf` |
| `icici` | ICICI Bank | `.pdf` |
| `hdfc` | HDFC Bank | `.pdf` |
| `generic` | Generic CSV | `.csv` (pre-normalized `ImportRow` columns) |

### `ImportRow` fields stored on each transaction

| Field | Source | Notes |
|-------|--------|-------|
| `occurredOn` | Value date (CSV) or PDF date | `YYYY-MM-DD` |
| `amountMinor` | Statement amount × 100 | Always positive; sign from `type` |
| `type` | `income` / `expense` | CSV: CR/DR column. PDF: balance delta sign |
| `merchant` | Parsed from description | See merchant rules below |
| `externalRef` | UPI-/IMPS-/NEFTINW-/etc. | Primary dedup key when present |
| `balanceMinor` | Running balance on statement | Used for account balance card |
| `sortOrder` | Kotak serial `#` column | Stable ordering within account history |

---

## Kotak CSV import

**File:** `src/lib/importers/kotak.ts` → `parseKotakCsv`

**Strategy:**
- Locate header row containing `Transaction Date`.
- Each data row: serial, dates, description, reference, amount, DR/CR, balance.
- Amount and type come directly from statement columns (reliable).
- Dates: `DD-MM-YYYY` → ISO.

**When to prefer CSV:** Debugging, spot-checking a single row, or when PDF text extraction is messy. CSV avoids page-footer and chunk-boundary bugs.

---

## Kotak PDF import

**Files:**
- `src/lib/server/pdf-text.ts` — `unpdf`, merges all pages, collapses whitespace to single spaces.
- `src/lib/importers/kotak-pdf.ts` — row parser.
- `src/lib/importers/kotak-shared.ts` — dates, merchants, refs, footer stripping.

**Strategy:**
1. Find transaction starts: `serial + date` e.g. `1476 10 Oct 2024`.
2. Chunk = text from this start until the **next** serial start (may span a page break).
3. **Strip page footers** from chunk (`stripKotakPdfChunkFooter`) — see issue #1 below.
4. Match trailing `amount balance` pair at end of cleaned chunk.
5. Derive `type` from balance delta vs previous row; store explicit `amountMinor` from statement (not `abs(delta)`).
6. Extract `externalRef` from end of description body.
7. Map description → `merchant` via `merchantFromDescription`.

**Tests:** `src/lib/importers/kotak-pdf.test.ts` — run with:

```bash
bun test src/lib/importers/kotak-pdf.test.ts
```

**Local parse check (full PDF):**

```bash
bun -e "
import { readFileSync } from 'fs';
import { extractPdfText } from './src/lib/server/pdf-text.ts';
import { parseKotakPdf } from './src/lib/importers/kotak-pdf.ts';
const bytes = readFileSync('./data/bank-all-2.pdf');
const { rows } = parseKotakPdf(await extractPdfText(new Uint8Array(bytes)));
console.log('parsed', rows.length, 'min/max serial', Math.min(...rows.map(r=>r.sortOrder)), Math.max(...rows.map(r=>r.sortOrder)));
"
```

---

## ICICI PDF import

**Files:**
- `src/lib/importers/icici-pdf.ts` — row parser.
- `src/lib/importers/icici-shared.ts` — dates (`DD.MM.YYYY`), refs, footer stripping, metadata.
- `src/lib/importers/icici.ts` — `BankImporter` (PDF only).

**Strategy:** Same chunking approach as Kotak — serial + date starts, strip page footers (`stripIciciPdfChunkFooter`), trailing `amount balance`, balance delta for type, UPI path refs (`/613728578923/`).

**Tests:** `src/lib/importers/icici-pdf.test.ts`

**Local parse check:**

```bash
bun -e "
import { readFileSync } from 'fs';
import { extractPdfText } from './src/lib/server/pdf-text.ts';
import { parseIciciPdf } from './src/lib/importers/icici-pdf.ts';
const bytes = readFileSync('./data/icici.pdf');
const { rows } = parseIciciPdf(await extractPdfText(new Uint8Array(bytes)));
console.log('parsed', rows.length, 'serials', rows.map(r => r.sortOrder).join(','));
"
```

---

## HDFC PDF import

**Files:**
- `src/lib/importers/hdfc-pdf.ts` — row parser.
- `src/lib/importers/hdfc-shared.ts` — dates (`DD/MM/YY`), UPI/ACH merchants, refs, footer stripping, metadata.
- `src/lib/importers/hdfc.ts` — `BankImporter` (PDF only).

**Strategy:** Transaction starts are `DD/MM/YY` followed by a letter (value dates are followed by amounts). Chunk until next start, strip page footers / `STATEMENT SUMMARY`, match trailing `ref + value date + amount + balance` (one of Withdrawal/Deposit is empty in the PDF text). Type from balance delta vs opening balance (from summary) / prior row. Refs are numeric Chq./Ref.No. values. UPI narrations use hyphens (`UPI-MERCHANT-vpa@bank`).

**Tests:** `src/lib/importers/hdfc-pdf.test.ts`

**Deferred parser hardening:** `_bmad-output/chhan-chhan/implementation-artifacts/deferred-work.md`

**Local parse check:**

```bash
bun -e "
import { readFileSync } from 'fs';
import { extractPdfText } from './src/lib/server/pdf-text.ts';
import { parseHdfcPdf } from './src/lib/importers/hdfc-pdf.ts';
const bytes = readFileSync('./data/hdfc.pdf');
const { rows, metadata } = parseHdfcPdf(await extractPdfText(new Uint8Array(bytes)));
console.log('parsed', rows.length, metadata);
"
```

---

## Generic CSV import

**File:** `src/lib/importers/index.ts` → `genericImporter`

**Strategy:** Expects CSV columns matching `ImportRow` / `csvImportRowSchema` (`occurredOn`, `amountMinor`, `type`, optional `merchant`, `notes`, `externalRef`). Validates every row with Zod. Use when converting statements outside the bank parsers.

---

## Account opening balance (Control)

Control → **Account** shows the earliest transaction date and lets editors set/clear an opening-balance snapshot on `finance_accounts` (`balance_minor`, `balance_as_of`).

| Action | Effect |
|--------|--------|
| Save opening balance | Writes account-level snapshot (used by `getCurrentBalance` and as a starting point when imports sync balances) |
| Clear opening balance | Nulls account snapshot |
| Clear all transactions | Deletes all txns (cascades links) **and** nulls account balance snapshot |
| Statement import | May advance account snapshot to the newest balance row in that file if newer than current |

Account balance in the UI may differ from the sum of filtered transactions — it is account-wide, not period-filtered. See balance sync section below.

---

## Merchant & reference parsing

**UPI:** `UPI/MERCHANT NAME/...` → merchant = second segment (may be **truncated** by Kotak).

Example: statement shows `UPI/Soni Neel Himan/...` not “Himanshu”. Search DB by `externalRef` or partial merchant, not full legal name.

**External ref patterns** (`kotak-shared.ts`):
- `UPI-…`, `IMPS-…`, `NEFTINW-…`, `ONBF-…`, or bare 10–15 digit refs.

**Dedup key** (`transaction-dedup.ts`):
- With ref: `externalRef|occurredOn|amountMinor|type`
- Without ref: `occurredOn|amountMinor|merchant|type`

Kotak **reuses refs** across related legs (deposit + fee, auth + reversal) — dedup key includes amount + type intentionally.

---

## Duplicate handling

**On import** (`skipDuplicates: true`, default in UI):
- Loads existing dedup keys for account; skips matching rows.
- Skipped rows appear in import report CSV (`import-report.ts`).

**Post-import dedupe** (`dedupeAccountTransactions`):
- SQL window: keep earliest row per dedup partition; prefer rows with `external_ref` and `balance_minor`.
- Does **not** catch duplicates that differ by amount/type (see issue #3).

**Full reset + reimport** (cleanest after parser fix):

```bash
bun --env-file=.env scripts/dedupe-transactions.ts <account-id> data/bank-all-2.pdf --reset
```

Warning: `--reset` deletes **all** transactions for the account (tags, groups, refund links cascade). Re-apply manual metadata afterward.

**Backfill only** (keep existing rows, add missing):

```bash
bun --env-file=.env scripts/dedupe-transactions.ts <account-id> data/bank-all-2.pdf
```

If old rows were imported with wrong amounts, backfill can create **duplicate sort_orders** with different amounts — prefer `--reset` after parser fixes.

---

## Known issues & fixes

### 1. Missing ~1 transaction per PDF page (FIXED)

**Symptom:**
- `sort_order` gaps in DB (~every 33–34 serials).
- Example: serial **1476** missing (`Soni Neel Himan`, `UPI-428451796244`, ₹10,000 on 2024-10-10).
- Parser output row count << PDF serial max (e.g. 2860 vs 2948).

**Cause:**
Last transaction on each page is followed by PDF footer text (`Statement Generated on…`, `Page N of88`, account holder line, etc.) before the next page’s first serial. Chunks extended to the next serial **on the following page**, so the amount regex (`amount balance` at `$`) failed.

**Fix:**
`stripKotakPdfChunkFooter()` in `kotak-shared.ts` truncates chunk before footer markers before parsing amounts.

**Verify gaps in DB:**

```sql
WITH expected AS (
  SELECT generate_series(
    (SELECT MIN(sort_order) FROM chhanchhan.finance_transactions),
    (SELECT MAX(sort_order) FROM chhanchhan.finance_transactions)
  ) AS sort_order
)
SELECT e.sort_order
FROM expected e
LEFT JOIN chhanchhan.finance_transactions t USING (sort_order)
WHERE t.id IS NULL
ORDER BY 1;
```

Expect **0 rows** after a good import.

---

### 2. Wrong amount/type on row after a dropped page-boundary txn (FIXED with #1)

**Symptom:**
When issue #1 dropped serial N, serial **N+1** was parsed using a corrupted balance delta (wrong `amountMinor` or even flipped `type`), while `balanceMinor` on the row still matched the statement.

**Cause:**
PDF parser used `abs(balanceDelta)` for amount before fix; skipped row broke the delta chain.

**Fix:**
Use explicit statement amount from PDF (`amountMatch[1]`) + delta sign for type only. Fixing #1 restores correct chain.

---

### 3. Partial backfill creates duplicate serials (OPERATIONAL)

**Symptom:**
After backfill without `--reset`, some `sort_order` values appear twice with different amounts/types.

**Cause:**
Old wrong row kept; new correct row inserted with same ref but different dedup key (amount/type differ).

**Fix:**
Run `--reset` reimport, or manual SQL delete of bad duplicates (keep row matching PDF parse).

---

### 4. PDF upload size limit (deploy)

**Symptom:** Import fails or truncates on large PDFs in production.

**Fix:** Set `BODY_SIZE_LIMIT=10M` (see `DEPLOY.md`). Default 512K is too small for multi-year statements.

---

### 5. Account-holder name in footer strip (LIMITATION)

`stripKotakPdfChunkFooter` includes a pattern for `MUKUL SINGH Account No.` — tied to current account holder. For other Kotak accounts, add a generic pattern (e.g. `/\sAccount No\.?\s*\d+/`) or derive name from PDF metadata.

---

### 6. Stale balance card

**Symptom:** Balance card shows “re-import statement to refresh”.

**Cause:** Latest transaction `occurred_on` is after account `balance_as_of` snapshot.

**Fix:** Re-import a statement covering recent activity; import syncs account balance from newest row with `balanceMinor`.

---

### 7. Import report “Duplicate reference” skips

**Symptom:** Rows skipped as duplicate in report.

**Expected:** Re-importing same file, overlapping date ranges, or legitimate Kotak ref reuse with identical date/amount/type.

**Check:** Download report CSV from import UI; compare `externalRef` to existing DB row.

---

## Debugging playbook

### A. Find a specific transaction

Search by ref (best), partial merchant, date, or amount:

```sql
SELECT sort_order, occurred_on, merchant, external_ref, amount_minor, type, balance_minor
FROM chhanchhan.finance_transactions
WHERE external_ref ILIKE '%428451796244%'
   OR (occurred_on = '2024-10-10' AND amount_minor = 1000000);
```

### B. Compare parser vs DB counts

| Check | Good state |
|-------|------------|
| Parsed rows from PDF | = max serial (e.g. 2948) |
| DB `COUNT(*)` | Same as parsed |
| DB `COUNT(DISTINCT sort_order)` | Same as total (no duplicate serials) |
| Missing serial query above | 0 rows |

### C. Inspect a failing PDF chunk

Extract text around serial (see debugging scripts in git history). Confirm footer appears between amount and next serial.

### D. Run tests after parser changes

```bash
bun test src/lib/importers/kotak-pdf.test.ts
```

Add a new fixture to `kotak-pdf.test.ts` for any new footer/header pattern before closing an import bug.

---

## Balance sync strategy

After row insert loop, `syncImportBalances`:
1. Updates `balance_minor` / `sort_order` on matching existing rows (for skipped duplicates).
2. Sets account-level `balance_minor` + `balance_as_of` from latest row in **this import file** (by date + sortOrder), if newer than current snapshot.

Account balance in UI may differ from sum of visible filtered transactions — it is account-wide, not period-filtered.

---

## Amounts & currency

- Storage: **minor units** (paise). ₹10,000.00 → `1000000`.
- Display: `formatMoney()` divides by 100.
- Indian bank strings: `parseIndianAmount()` handles `2,18,198.00` grouping.

---

## Related scripts

| Script | Purpose |
|--------|---------|
| `scripts/dedupe-transactions.ts` | Dedupe, backfill, or `--reset` + full reimport from PDF |
| `scripts/sync-from-excel.ts` | Legacy Excel → categories (not statement import) |
| `scripts/clear-transaction-notes.ts` | Bulk note cleanup |

---

## Checklist: new full-statement import

1. [ ] Confirm `BODY_SIZE_LIMIT` in prod if PDF is large.
2. [ ] Import via Control or CLI.
3. [ ] Note accepted / skipped / rejected counts.
4. [ ] If skipped > 0, download and review import report CSV.
5. [ ] Verify: `COUNT(*) = COUNT(DISTINCT sort_order) = parsed row count`.
6. [ ] Spot-check balance card vs statement closing balance.
7. [ ] Search for a known recent txn by `external_ref`.
8. [ ] Re-apply tags, groups, refund links if this was a `--reset` reimport.

---

## Future improvements (see also `FUTURE-TODO.md`)

- Import history + rollback per file
- Duplicate review queue before commit
- Generic footer stripping (not hardcoded account name)
- Filtered CSV export from the transaction table
- Additional bank importers using same `BankImporter` interface
- HDFC/ICICI/Kotak parser edge cases listed in `_bmad-output/chhan-chhan/implementation-artifacts/deferred-work.md`
