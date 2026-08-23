---
status: draft
created: 2026-08-23
updated: 2026-08-23
sources:
  - ../../prds/prd-chhan-multi-account-2026-08-23/prd.md
  - ./DESIGN.md
---

# EXPERIENCE.md — Chhan multi-account

## Foundation

- **Form-factor:** Responsive web; primary use desktop, Control usable on narrow screens.
- **UI system:** Existing forge / Chhan Chhan chrome (`DESIGN.md`). Visual tokens by reference only.

## Information Architecture

```
Protected shell
├── Account Switcher (global)     ← Active Account + Create
├── /app                          ← ledger of Active Account
├── /app/dashboards               ← widgets of Active Account
└── /app/control                  ← import/export/metadata of Active Account
```

No `/accounts/[id]` URL required for MVP; Active Account is shell state. Deep links that embed `accountId` in API paths continue to use layout-provided id.

## Voice and Tone

- Imperative, short, uppercase CTAs where forge already does (“CREATE ACCOUNT”, “IMPORT STATEMENT”).
- Danger and import copy must include the Active Account name: e.g. “Clear all transactions for **HDFC**?”
- Import helper: “Imports go into **{Active Account}**.”

## Component Patterns

### Account Switcher

- Opens on click; closes on Escape, outside click, or successful select/create (mirror App Settings behavior).
- Selecting an account: close menu → invalidate layout/data → surfaces reload for new Active Account.
- Single-account: menu still opens (shows one row + Create)—does not hide switcher.

### Create Account

- Available from switcher footer and optionally duplicated under Control → Account.
- On success: new account becomes Active; flash “Created {name}”; stay on current route.
- On validation error: keep menu/form open with message.

## State Patterns

| State | Behavior |
|-------|----------|
| Loading memberships | Trigger shows skeleton or last known name; menu disabled |
| One account | List has one selected row; Create available |
| Many accounts | Selected marked; others selectable |
| Importing | Switch blocked; menu explains “Finish or cancel import to switch” |
| Invalid stored id | Silent fallback to first-by-name; no error banner unless all memberships gone |
| Create in flight | Submit disabled; “CREATING…” |

## Interaction Primitives

- Keyboard: Arrow keys move list highlight; Enter selects; Escape closes.
- Focus return to trigger after close.
- No drag-and-drop.

## Accessibility Floor

- Trigger and listbox roles/labels naming Active Account.
- Create fields use forge `.field` labeling.
- Confirm dialogs for clear-all must include account name in visible text.

## Key Flows

### Flow A — Create + import (UJ-1)

1. User opens switcher → Create account → enters name/currency → submits.
2. Shell sets Active Account to new id.
3. User opens Control; copy shows Active Account name; imports statement.
4. Ledger shows only new account’s rows.

### Flow B — Switch accounts (UJ-2)

1. User opens switcher → selects other account.
2. All shell children reload for that id.
3. Categories/tags/groups lists change with account.

### Flow C — Single account continuity (UJ-3)

1. User with one account uses app as today.
2. Switcher visible but low friction; Create optional.

## Inspiration & Anti-patterns

- **Inspired by:** App Settings menu pattern already in-app; bank apps’ account dropdown in chrome.
- **Anti-pattern:** Forcing URL restructuring of every route; merging all accounts into one ledger view; silent import into a non-visible account.

## Responsive & Platform

- On narrow screens, switcher menu full-width under topbar; Create fields stack.
- Touch targets ≥ 40px for list rows.
