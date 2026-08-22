---
title: 'HDFC Bank PDF statement importer'
type: 'feature'
created: '2026-08-22'
status: 'done'
route: 'one-shot'
context: []
---

# HDFC Bank PDF statement importer

## Intent

**Problem:** Chhan Chhan could import Kotak and ICICI statements but not HDFC NetBanking account statement PDFs.

**Approach:** Add a PDF-only `hdfc` `BankImporter` that parses NetBanking text extraction (date / narration / ref / value date / amount / balance), registers it in the importer list, and covers the layout with unit tests.

## Suggested Review Order

**Parser core**

- Chunk by txn date, strip footers, trailing ref + amounts, balance-delta type
  [`hdfc-pdf.ts:18`](../../../apps/chhan-chhan/src/lib/importers/hdfc-pdf.ts#L18)

- UPI/ACH merchants, date parse, footer markers, opening-balance metadata
  [`hdfc-shared.ts:1`](../../../apps/chhan-chhan/src/lib/importers/hdfc-shared.ts#L1)

**Registration & UI**

- Register `hdfcImporter` beside Kotak/ICICI
  [`index.ts:32`](../../../apps/chhan-chhan/src/lib/importers/index.ts#L32)

- BankImporter entry (PDF-only)
  [`hdfc.ts:10`](../../../apps/chhan-chhan/src/lib/importers/hdfc.ts#L10)

- Control upload copy mentions HDFC
  [`+page.svelte:115`](../../../apps/chhan-chhan/src/routes/(protected)/app/control/+page.svelte#L115)

**Tests & docs**

- Withdrawal batch + deposit income fixture
  [`hdfc-pdf.test.ts:39`](../../../apps/chhan-chhan/src/lib/importers/hdfc-pdf.test.ts#L39)

- Strategy notes for local parse checks
  [`IMPORT.md:112`](../../../apps/chhan-chhan/IMPORT.md#L112)
