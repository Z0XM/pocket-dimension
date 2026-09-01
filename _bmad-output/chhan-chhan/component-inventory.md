# Component Inventory — `chhan-chhan`

Feature components, importers, server libs, and finance helpers. Full per-file detail (props, patterns, risks) lives in [deep-dive-chhan-chhan.md](./deep-dive-chhan-chhan.md) — this doc is the at-a-glance catalog. LOC counts are from the deep dive (`wc -l`, 2026-09-01).

## Feature components (`src/lib/components/`, 13 files, flat — no `ui/` subfolder)

| Component | LOC | Used by | Summary |
| --- | --- | --- | --- |
| `app-nav.svelte` | 21 | `/app`, `/app/dashboards` topbars | Two-tab nav (Transactions/Dashboards). |
| `app-settings.svelte` | 49 | all 3 protected pages' topbars | Settings gear dropdown — Control link + sign out. Outside-click/Escape-close `$effect`, a pattern also duplicated in `filter-multiselect.svelte` and `dashboard-widget-picker.svelte` (no shared "click outside" action exists). |
| `beta-banner.svelte` | 34 | `(protected)/app/+layout.svelte` | Static "Beta" strip; hidden only in `dev` mode (always shows in preview/prod regardless of actual release stage). |
| `billing-panel.svelte` | 182 | `/app/dashboards` (monthly + yearly bills widgets) | Bill-category spend grouped by category → merchant; `mode: "monthly" | "yearly"`. Yearly mode renders one chip per billed month uncapped — no scroll/overflow guard for merchants billed many months. |
| `calculate-widget.svelte` | 135 | `/app` (calculate-mode floating bar) | Fully controlled — live count/sum of selected rows, `role="status" aria-live="polite"`. |
| `category-trend-chart.svelte` | 144 | `/app/dashboards` | Hand-built CSS stacked-segment chart (no charting library). |
| `dashboard-widget-picker.svelte` | 221 | `/app/dashboards` topbar | Popover checklist grouped by widget category; guarantees ≥1 widget stays enabled. |
| `filter-multiselect.svelte` | 256 | `/app` (Categories/Tags filter dropdowns) | Most "reinvented" UI plumbing in the app — manual `getBoundingClientRect()` viewport-clamped positioning (magic numbers `272`/`8` tied to current panel width) instead of a floating-UI library. |
| `income-expense-bars.svelte` | 80 | `/app/dashboards` | Two-row In-vs-Out CSS bar comparison. |
| `meter-bar.svelte` | 32 | `/app` (budget meters), 5 dashboard widgets | The app's single most reused, best-factored primitive — generic labeled progress-bar row. |
| `monthly-trend-chart.svelte` | 130 | `/app/dashboards` | Hand-built CSS paired income/expense bar chart. |
| `smart-categorize-popup.svelte` | 277 | `/app` (bulk categorize modal) | Composite `merchant::categoryId` string key correlates checkbox state — undefended against a `::`-containing merchant name. |
| `smart-tag-popup.svelte` | 368 | `/app` (bulk tag modal, largest component) | Tag equivalent of the categorize popup, plus `append`/`replace` mode; its own independent composite-key serialization (`fromTagIds.join(",")`) must exactly match the parent's — a second, separate implementation of the same correlation concept. |

**Observation:** only `app-nav`, `app-settings`, `beta-banner`, and `meter-bar` are genuinely cross-page reusable; the rest are single-feature-area (dashboards-only charts/panels or ledger-only modals). There is no shared "click outside to close" primitive despite the pattern recurring in three components, and the two smart-popups share ~80% of layout/CSS with no shared base component.

## Importers (`src/lib/importers/`)

| File | LOC | Role |
| --- | --- | --- |
| `types.ts` | 44 | `ImportRow`, `ImportResult`, `StatementInput`, `BankImporter` contract. |
| `index.ts` | 53 | Registry (`getImporter`, `listImporters`, `importerAcceptList`) + the inline `genericImporter` (expects **pre-converted minor-unit amounts**, unlike every bank importer which converts major→minor). |
| `import-report.ts` | 48 | Builds the downloadable skipped/rejected-rows CSV. Hardcodes `formatMoney(amountMinor, "INR")` — a non-INR account's report mislabels amounts with a ₹ symbol. |
| `transaction-dedup.ts` | 19 | `transactionFingerprint`/`transactionDedupKey` — shared pre-import skip check + post-import SQL dedupe key. |
| `kotak.ts` | 86 | Dispatches to CSV or PDF parsing by MIME/extension; CSV path parsed inline. |
| `kotak-shared.ts` | 154 | Date/merchant/ref parsing, **two** page-footer strippers (legacy + "monthly" formats), both hardcoding the account-holder name "MUKUL SINGH" — see [project-context.md](./project-context.md). |
| `kotak-pdf.ts` | 120 | Two independent PDF parsers (`parseKotakLegacyPdf`, `parseKotakMonthlyPdf`) selected by `isKotakMonthlyPdf`; the monthly format's rows are reverse-chronological in the source PDF and require an explicit `.reverse()`. |
| `icici.ts` | 22 | PDF-only `BankImporter`. |
| `icici-shared.ts` | 101 | Date/description/ref/footer/metadata helpers; large transaction-type-prefix alternation regex — any unlisted prefix falls through to the raw untrimmed body. |
| `icici-pdf.ts` | 62 | Reuses **Kotak's** `merchantFromDescription` (cross-bank coupling); silently drops rows with `amountMinor <= 0`. |
| `hdfc.ts` | 22 | PDF-only `BankImporter`. |
| `hdfc-shared.ts` | 98 | Date/merchant/ref/footer/opening-balance helpers; 2-digit-year assumption (`20${yy}`); intricate VPA-boundary-lookahead merchant regex (well-tested, 4 assertions). |
| `hdfc-pdf.ts` | 65 | `sortOrder` is positional (`parsedRows.length + 1`), not from a bank-provided serial like Kotak/ICICI — no way to detect a dropped row via sequence-number gap. Same `amountMinor <= 0` silent-drop as ICICI. |

## Server libs (`src/lib/server/`)

| File | LOC | Role |
| --- | --- | --- |
| `authz.ts` | 25 | `requireUser`, `getMembershipOrThrow`, `canEdit` — the authz chokepoint (see [architecture.md](./architecture.md)). |
| `balance.ts` | 33 | Pure balance-snapshot comparison helpers. |
| `csv-parse.ts` | 59 | RFC4180-aware tokenizer — the parser actually used for import. |
| `csv.ts` | 35 | Export CSV builder (`toCsv`) plus a naive, **dead** `parseCsv` export (never imported anywhere — see [project-context.md](./project-context.md)). |
| `http.ts` | 26 | `readJsonBody`/`parseSearch`, Zod-validated, called after authz in every route. |
| `pdf-text.ts` | 7 | `extractPdfText` via `unpdf` — whitespace-collapsed, load-bearing for every PDF regex. |
| `import.ts` | 301 | Import engine: dedup, sequential unbatched insert loop, balance sync, full reset, SQL-window post-import dedupe. |
| `finance.ts` | 1,844 | All CRUD + analytics — ~45 exported functions across accounts, categories, tags, groups, transactions, budgets, goals, refund-links, smart-cat/tag, and every dashboard aggregate. Largest file in the app by a wide margin. |

## Finance domain helpers (`src/lib/finance/`)

| File | LOC | Role |
| --- | --- | --- |
| `money.ts` | 35 | `parseSqlMinor`, `formatMoney` (₹ special-cased, `en-IN`), `parseIndianAmount`. |
| `currencies.ts` | 16 | UI-only list of 10 supported currency codes — not enforced server-side. |
| `summary.ts` | 129 | Period selection/formatting (month-key parsing, year resolution, date-range derivation, `en-IN` label formatting). |
| `refunds.ts` | 12 | `isRefundCategoryName`/`refundLinkKind` — **name-string match** against `"Refund"`/`"Split Return"`, fragile by design. |
| `bill-categories.ts` | 19 | `isBillCategoryName` — name-regex `/\bbill\b/i` match, same fragility pattern as refunds. |
| `transaction-warnings.ts` | 116 | `computeRefundLinkWarnings` — BFS connected-components algorithm over the refund-link graph, correctly handles N:M links. |
| `dashboard-widgets.ts` | 298 | `DASHBOARD_WIDGET_CATALOG` (14 widgets across 5 categories), meter-row builders, `METER_COLORS`, category-trend chart data builder. |
| `filter-params.ts` | 19 | Comma-joined multi-value URL param helpers. |
| `merchant-match.ts` | 55 | Fuzzy merchant matching (Levenshtein + substring-containment shortcut) for smart-categorize/smart-tag. |
| `transaction-search.ts` | 75 | Free-text (`ILIKE`) + amount-substring search predicates; the digit-substring fallback can false-positive-match unrelated amounts. |
| `billing.ts` | — (not in Part A of the deep dive; consumed by `billing-panel.svelte`) | Builds the monthly/yearly bill-by-category-by-merchant breakdown. |

## `ui/*` primitive groups

**`apps/chhan-chhan` has no `src/lib/components/ui/` directory** — no `bits-ui`/shadcn dependency exists in this app's `package.json`. Every interactive primitive (buttons, inputs, selects) is a hand-written native HTML element styled with Tailwind utility classes or the global `forge.css`/scoped `<style>` system. This is a deliberate contrast with `watchlist` (see `_bmad-output/watchlist/component-inventory.md`), which has a full shadcn-svelte `ui/` primitive set — trading shared-primitive reuse for a fully bespoke "forge" neubrutalist visual identity. The cost is real, app-internal duplication: three near-identical Categories/Tags/Groups CRUD sections in `control/+page.svelte`, two near-identical smart-popup modals, and three independent URL-builder functions (`appUrl` in the ledger, `dashboardUrl`/`transactionsUrl` in dashboards).

## Known duplication across components (candidates for extraction)

- **Meter color palette:** the ledger's `+page.server.ts` hardcodes the same 5-color array (`["#bd93f9","#50fa7b","#54dbee","#ee7c02","#ffb86c"]`) that `dashboard-widgets.ts` already exports as `METER_COLORS` (used only by the dashboards loader) — any palette change must be made in two places.
- **Composite correlation-key serialization:** `smart-categorize-popup.svelte`/`smart-tag-popup.svelte` and their parent (`/app/+page.svelte`) each independently implement "merchant + prior-category/tags" composite string keys; a mismatch would silently desync checkbox state.
- **URL-builders:** `appUrl` (ledger), `dashboardUrl` and `transactionsUrl` (dashboards) independently re-encode the same summary/period query params.
- **Categories/Tags/Groups CRUD:** copy-pasted three times in `control/+page.svelte` with only field-shape differences (categories have `kind` + color; tags have color only; groups have neither).
- **Strong-password regex** and auth error-copy maps: duplicated across the `(auth)` route group pages, mirroring the same pattern documented in `watchlist`'s auth pages (both apps share a near-identical auth-page template).
- **Merchant heuristic reuse across banks:** `icici-pdf.ts` reuses Kotak's `merchantFromDescription` rather than an ICICI-specific extractor — works today because both formats start with `UPI/`, but is a cross-bank coupling.
