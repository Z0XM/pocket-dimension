---
title: Chhan Chhan multi-account
status: draft
created: 2026-08-23
updated: 2026-08-23
sources:
  - _bmad-output/chhan-chhan/project-context.md
  - _bmad-output/chhan-chhan/planning-artifacts/architecture.md
  - apps/chhan-chhan/FUTURE-TODO.md
  - conversation: multi-account BMAD plan 2026-08-23 (MVP = create + switcher + scoped surfaces; defer transfers/FX/household)
---

# PRD: Chhan Chhan multi-account

*Working title — Multi bank accounts for statement import and ledger scoping.*

## 0. Document Purpose

This PRD defines the **multi-account MVP** for Chhan Chhan for PM, UX, and architecture follow-on. Vocabulary is Glossary-anchored; features group FRs with globally stable IDs. Assumptions tagged `[ASSUMPTION]`. It builds on existing brownfield docs (`project-context.md`, brownfield `architecture.md`) and does not redesign statement importers.

## 1. Vision

Chhan Chhan today is a personal finance ledger that already stores data per **Finance Account**, but the product UI always opens the first membership. Users who hold multiple bank relationships (e.g. Kotak salary + HDFC savings) must either merge statements into one ledger or lose the ability to keep balances and imports honest per bank.

This release makes **Finance Accounts first-class in the UI**: create additional accounts, switch the active one, and have every surface—ledger, dashboards, Control import/export/opening balance/clear-all, categories/tags/groups—operate only on that Active Account. Statement importers stay as they are; the Active Account is the import target.

## 2. Target User

### 2.1 Jobs To Be Done

- Keep separate bank ledgers without mixing statement balances.
- Import each bank’s PDF/CSV into the matching Finance Account.
- See the correct running balance and metadata for the bank they are looking at.
- Switch quickly between banks without losing session or re-logging in.

### 2.2 Non-Users (v1)

- Household co-editors needing invite/share flows (membership exists; invite UI deferred).
- Users needing FX-consolidated net worth across currencies.
- Users needing automated pairing of money moved between their own banks.

### 2.3 Key User Journeys

- **UJ-1. Bhavye adds an HDFC account and imports into it.**
  - **Persona + context:** Already has a “Personal” Finance Account with Kotak imports; opens Control after downloading an HDFC NetBanking PDF.
  - **Entry state:** Authenticated; Active Account is Personal.
  - **Path:** Opens account switcher → Create account → names it “HDFC”, currency INR → system selects the new Active Account → Control import picks HDFC importer → uploads PDF → sees accepted rows and HDFC balance card.
  - **Climax:** Ledger and balance show only HDFC rows; Personal/Kotak data unchanged.
  - **Resolution:** Switcher shows both accounts; next visit restores HDFC as Active Account. `[ASSUMPTION: selection persists across browser sessions.]`
  - **Edge case:** Create fails validation (empty name) → stays on prior Active Account; no orphan membership.

- **UJ-2. Bhavye switches back to Personal to categorize Kotak spend.**
  - **Persona + context:** Mid-month cleanup; HDFC was last used.
  - **Entry state:** Authenticated on `/app` with HDFC Active.
  - **Path:** Opens switcher → selects Personal → ledger/filters/categories reload for Personal.
  - **Climax:** Category/tag lists and balance match Personal, not HDFC.
  - **Resolution:** Control and dashboards also reflect Personal without extra navigation.
  - **Edge case:** Switcher while import stream is running → `[ASSUMPTION: block switch or cancel/confirm abandon of in-flight import.]`

- **UJ-3. Single-account user notices nothing broken.**
  - **Persona + context:** Only one Finance Account exists (auto-created “Personal”).
  - **Path:** Uses ledger/import as today; switcher shows one account and Create.
  - **Climax:** Import and balance behave as before.
  - **Resolution:** No migration step required.

## 3. Glossary

- **Finance Account** — A user-owned ledger container (`finance_accounts`) with its own currency, opening-balance snapshot, transactions, categories, tags, groups, budgets, and goals. One user may have many Finance Accounts.
- **Active Account** — The Finance Account currently selected in the UI; all product surfaces read and write against it until the user switches.
- **Account Switcher** — UI control to list Finance Accounts, select Active Account, and start Create.
- **Create Account** — Flow that creates a Finance Account + owner membership and makes it Active.
- **Membership** — Row linking a user to a Finance Account with role `owner` | `editor` | `viewer`.
- **Statement Import** — BankImporter parse + insert into the Active Account’s transactions.
- **Opening Balance** — Account-level `balance_minor` / `balance_as_of` snapshot for the Active Account.

## 4. Features

### 4.1 Account Switcher and persistence

**Description:** Authenticated users see the Active Account name in chrome and can open the Account Switcher to pick another Finance Account they are a member of. Selection persists across pages and browser sessions. Realizes UJ-2, UJ-3.

**Functional Requirements:**

#### FR-1: List memberships

Editor/owner/viewer can see all Finance Accounts they belong to, ordered predictably (e.g. by name). Realizes UJ-2, UJ-3.

**Consequences (testable):**
- Switcher lists every membership for the session user.
- Archived accounts are hidden or clearly marked. `[ASSUMPTION: archived accounts hidden from switcher in MVP.]`

#### FR-2: Select Active Account

User can set Active Account to any listed Finance Account. Realizes UJ-2.

**Consequences (testable):**
- After selection, `/app`, `/app/dashboards`, and `/app/control` load data only for that account id.
- Invalid or foreign account id in stored preference falls back to first membership by name without error page.

#### FR-3: Persist Active Account

Active Account survives navigation and new sessions for that browser. Realizes UJ-1, UJ-2.

**Consequences (testable):**
- Reloading the app restores the last valid Active Account.
- Clearing the preference falls back to first-by-name membership.

### 4.2 Create Finance Account

**Description:** Editors/owners can create a named Finance Account with currency (timezone defaults). New account becomes Active. Realizes UJ-1.

**Functional Requirements:**

#### FR-4: Create Account

Owner/editor can create a Finance Account with a display name and currency code. Realizes UJ-1.

**Consequences (testable):**
- Creates `finance_accounts` row + owner membership for the current user.
- Rejects empty/too-short names per existing validation.
- New account becomes Active Account immediately.

#### FR-5: Zero-migration continuity

Existing users with one Finance Account keep using it without a data migration. Realizes UJ-3.

**Consequences (testable):**
- First visit still auto-creates “Personal” if none exist (current behavior).
- No required rename or split of historical transactions.

### 4.3 Surface scoping to Active Account

**Description:** Every product surface that currently uses `getOrCreateDefaultAccount` / layout `account` uses Active Account instead—including Statement Import, export, Opening Balance, clear-all, ledger filters, dashboards, and metadata CRUD. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-6: Ledger and balance scoped

Transaction list, filters, refund links, smart cat/tag, and balance card use Active Account only. Realizes UJ-2.

**Consequences (testable):**
- Switching accounts changes visible transactions and balance within one navigation cycle (invalidate/reload).

#### FR-7: Dashboards scoped

Dashboard widgets and analytics use Active Account only. Realizes UJ-2.

#### FR-8: Control scoped

Import (stream and legacy), export CSV, currency, Opening Balance set/clear, clear-all transactions, categories/tags/groups CRUD use Active Account only. Realizes UJ-1, UJ-2.

**Consequences (testable):**
- Import inserts rows with Active Account’s `account_id`.
- Clear-all deletes only Active Account transactions and clears that account’s Opening Balance snapshot.
- Categories list after switch matches the other account’s metadata, not a merged list.

#### FR-9: API client binding

Browser calls that already take `accountId` use Active Account id from layout data. Realizes UJ-1, UJ-2.

**Consequences (testable):**
- No Control form action silently re-resolves “default first account” when Active Account differs.

### 4.4 Import targeting

**Description:** Statement Import always targets Active Account. Bank importer id remains an independent choice (Kotak/ICICI/HDFC/Generic). Realizes UJ-1.

**Functional Requirements:**

#### FR-10: Import into Active Account

User imports a statement into Active Account without a separate “target account” picker on the import form. Realizes UJ-1.

**Consequences (testable):**
- Import API/stream receives Active Account id.
- Copy in Control states which Active Account will receive the import.

**Out of Scope:** Binding a Finance Account permanently to one bank importer.

## 5. Non-Goals (Explicit)

- Inter-account **paired transfers** (no double-count when moving money between own banks).
- FX / multi-currency consolidated reporting.
- Household invite / share UI (roles already in schema).
- Renaming or merging Finance Accounts in MVP. `[ASSUMPTION: rename can be a small follow-up if needed.]`
- Changing BankImporter registry or adding banks.
- Multi-account in a single dashboard view (side-by-side).

## 6. MVP Scope

### 6.1 In Scope

- Account Switcher + Create Account
- Persist Active Account
- Scope ledger, dashboards, Control (import/export/opening balance/clear-all/metadata) to Active Account
- Fix Control/server paths that ignore selection and re-default to first account
- In-app doc touch: FUTURE-TODO / project-context pointer

### 6.2 Out of Scope for MVP

- Transfers between accounts (deferred — FUTURE-TODO)
- FX consolidation (deferred)
- Household invites (deferred)
- Epics/implementation in this planning slice stop after Architecture

## 7. Success Metrics

- User can create a second Finance Account and import a different bank statement into it without affecting the first account’s row count or balance snapshot.
- After reload, Active Account is restored when still a valid membership.
- Single-account users report no change in primary import path (qualitative / smoke).

**Counter-metrics:** Do not increase accidental clear-all across the wrong account—clear-all copy must name the Active Account.

## 8. Risks and Open Questions

- Mid-import account switch (confirm vs block) — see UJ-2 edge. `[ASSUMPTION: block switch while `importing` is true.]`
- Whether to show currency next to account name in switcher when currencies differ.
- Cookie vs other persistence — resolved in Architecture (cookie preferred for SSR layout).

## 9. Assumptions index

- `[ASSUMPTION]` Selection persists across browser sessions.
- `[ASSUMPTION]` Archived accounts hidden from switcher in MVP.
- `[ASSUMPTION]` Block Active Account switch while import stream is in progress.
- `[ASSUMPTION]` Rename account deferred unless needed for UX clarity.

---

*Downstream: UX (`ux-chhan-multi-account-2026-08-23`), Architecture (`architecture-multi-account.md`). Epics deferred until review.*
