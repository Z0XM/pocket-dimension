---
title: 'chhan-chhan mobile-friendly screens'
type: 'feature'
created: '2026-10-05'
status: 'ready-for-dev'
context:
  - '{project-root}/_bmad-output/chhan-chhan/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Several chhan-chhan screens (especially Transactions and Spaces) are desktop-first: wide tables, crowded top chrome, and tiny touch targets make the app hard to use on phones (~375px).

**Approach:** Keep the existing sketch/forge visual language. Add mobile breakpoints that stack chrome, convert dense tables into card-like rows, enlarge touch targets, and fix overflow/popover placement — without redesigning desktop layouts.

## Boundaries & Constraints

**Always:**
- Preserve sketch-paper / forge aesthetic (hand fonts, rough marks, paper sheets).
- Desktop (≥721px) layouts stay intact unless a change is required for shared selectors.
- Use CSS-first responsive patterns; avoid duplicating entire page markup when grid/card restyles suffice.
- Auth, guide, and dashboards already have useful MQs — improve without regressing them.

**Ask First:**
- Replacing top nav with a hamburger drawer.
- Removing desktop table columns permanently (hiding Balance on mobile is OK).

**Never:**
- New design system, purple/glow theme, or generic card-dashboard look.
- Backend/API/schema changes.
- Multi-account product work beyond existing switcher chrome.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Phone ledger | Viewport ≤640px on `/app/transactions` | No horizontal page overflow; rows read as stacked cards; chrome fits without crushing the sheet | N/A |
| Phone spaces | Viewport ≤640px on `/app/spaces/[id]` | Tabs scroll horizontally; txn rows stacked; settle amount wraps | N/A |
| Desktop regression | Viewport ≥900px | Existing multi-column tables and topbar unchanged | N/A |
| Touch actions | Tap note/space/tag/filter icons | Hit area ≥~40px; popovers stay in viewport | Disabled state unchanged |

</frozen-after-approval>

## Code Map

- `apps/chhan-chhan/src/lib/styles/forge.css` -- shared shell, topbar, nav, table-sheet, content padding
- `apps/chhan-chhan/src/lib/components/app-nav.svelte` -- Dashboard/Transactions tabs + account switcher
- `apps/chhan-chhan/src/lib/components/filter-multiselect.svelte` -- filter icon hit area
- `apps/chhan-chhan/src/lib/components/import-review-panel.svelte` -- control import review table
- `apps/chhan-chhan/src/lib/components/smart-tag-popup.svelte` -- smart-tag CTA stack
- `apps/chhan-chhan/src/routes/(protected)/app/transactions/+page.svelte` -- ledger (P0)
- `apps/chhan-chhan/src/routes/(protected)/app/spaces/[spaceId]/+page.svelte` -- space notebook (P0)
- `apps/chhan-chhan/src/routes/(protected)/app/control/+page.svelte` -- organize density
- `apps/chhan-chhan/src/routes/(protected)/app/dashboards/+page.svelte` -- tip stickies / period tabs
- `apps/chhan-chhan/src/routes/(protected)/app/guide/+page.svelte` -- note minmax tweak

## Tasks & Acceptance

**Execution:**
- [ ] `forge.css` -- mobile content padding, topbar/nav/settings hit areas, meters 1-col on narrow -- shared chrome usable on phones
- [ ] `transactions/+page.svelte` -- ≤640px card rows, denser chrome, larger icon/tab hits, in-viewport popovers -- ledger usable without horizontal scroll
- [ ] `spaces/[spaceId]/+page.svelte` -- scrollable tabs, card rows, wrap settle amount -- space page usable on phones
- [ ] `filter-multiselect.svelte` + `smart-tag-popup.svelte` -- enlarge hits / stack CTAs -- touch-friendly controls
- [ ] `import-review-panel.svelte` + `control/+page.svelte` -- card/stack organize + import on narrow -- control usable
- [ ] `dashboards/+page.svelte` + `guide/+page.svelte` -- hide/compact tips, larger period tabs, safer minmax -- polish remaining screens
- [ ] Manual viewport checks at ~375px and ~1280px on key routes -- evidence for PR

**Acceptance Criteria:**
- Given a ~375px viewport, when opening Transactions, then the page has no horizontal overflow and transaction rows remain readable/actionable.
- Given a ~375px viewport, when opening Spaces, then tabs and settle form fit without clipping critical controls.
- Given a ~375px viewport, when tapping nav/settings/row actions, then targets are comfortably tappable (≥~40px).
- Given a ≥900px viewport, when using the same pages, then desktop table/topbar layout is preserved.

## Spec Change Log

## Design Notes

Prefer CSS `display: grid` card restyles of existing `<tr>` cells over dual DOM. Hide Balance column visually on mobile if needed; keep Amount + Merchant + Tags primary. Popovers: open below/left-aligned with `right: 0; left: auto` on narrow viewports instead of always `left: 100%`.

Breakpoint convention already in app: ~640–720–860–900px. Use **640px** for phone card layouts and **720px** where existing MQs already exist.

## Verification

**Commands:**
- `cd apps/chhan-chhan && bun run check` -- expected: no new type/svelte errors from style/markup changes

**Manual checks:**
- Browse `/app/transactions`, `/app/dashboards`, `/app/control`, `/app/guide`, `/app/spaces/[id]`, and an auth page at 375×812 and desktop width; confirm no page-level horizontal scroll and usable chrome.
