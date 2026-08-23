---
status: draft
created: 2026-08-23
updated: 2026-08-23
sources:
  - ../../prds/prd-chhan-multi-account-2026-08-23/prd.md
  - apps/chhan-chhan/src/lib/styles/forge.css
colors:
  accent: "{forge.accent}"
  chromeLine: "{forge.chrome-line}"
  surface: "{forge.surface}"
  surface2: "{forge.surface2}"
  mainText: "{forge.main-text}"
  muted: "{forge.muted}"
  danger: "{forge.danger}"
typography:
  display: "Archivo Black"
  body: "inherit / forge body"
rounded:
  none: "0" # forge is sharp chrome
spacing:
  panelGap: "1rem"
  fieldGap: "0.75rem"
components:
  accountSwitcherTrigger: "chrome button showing Active Account name"
  accountSwitcherMenu: "surface panel, 2px chrome border, offset shadow"
  createAccountForm: "Control-style field + add button"
---

# DESIGN.md — Chhan multi-account

## Brand & Style

Extend existing **forge** chrome (sharp borders, offset box-shadows, uppercase micro-labels). Do not introduce a new visual language. Account Switcher should feel like `AppSettings` / Control panels.

## Colors

Use forge CSS variables: `{colors.accent}`, `{colors.chromeLine}`, `{colors.surface}`, `{colors.surface2}`, `{colors.mainText}`, `{colors.muted}`, `{colors.danger}`. Active Account name in chrome uses `{colors.mainText}`; secondary currency hint uses `{colors.muted}`.

## Typography

- Switcher trigger / Create CTA: `{typography.display}` at ~0.72rem uppercase where matching `.add` / forge buttons.
- Account list names: body weight, readable; no emoji.

## Layout & Spacing

- Switcher trigger lives in the protected **topbar actions** cluster (next to App Settings / back links), not floating over content.
- Menu width ~ min(18rem, 90vw); list items full-bleed hit targets ≥ 40px tall.
- Create form: stack fields with `{spacing.fieldGap}` inside menu or Control Account panel.

## Elevation & Depth

Menus use forge `box-shadow: 3px 3px 0 {colors.chromeLine}` (same as `.add`).

## Shapes

`{rounded.none}` — square chrome, no pills.

## Components

### Account Switcher trigger

- Label: Active Account **name** (truncate with ellipsis if long).
- Optional muted currency code suffix when useful.
- `aria-haspopup="listbox"` / `aria-expanded`.

### Account Switcher menu

- List of Finance Accounts; selected row indicated with accent left border or bold name (not a filled purple chip).
- Footer action: **Create account** opens inline fields or navigates focus to create form.
- Disabled state when import in progress: trigger shows Active Account; opening menu shows dimmed list + short reason.

### Create account

- Fields: Name (required), Currency (select from existing `SUPPORTED_CURRENCIES`).
- Primary button: forge `.add` “CREATE ACCOUNT”.
- Errors: forge flash / field-level text in `{colors.danger}`.

## Do's and Don'ts

- **Do** reuse forge panel/field/add/danger patterns from Control.
- **Do** name the Active Account in Danger zone / import copy.
- **Don't** introduce card grids, soft purple gradients, or rounded-full pills.
- **Don't** hide the Active Account name—users must always know which ledger they are in.
