---
name: dashboard
status: final
created: 2026-08-23
updated: 2026-08-23
sources:
  - ../../prds/prd-dashboard-2026-08-23/prd.md
  - ./DESIGN.md
  - /home/z0xm/sales-incentives-service/packages/dev-dashboard (branch: dev)
---

# EXPERIENCE.md — dashboard

## Foundation

Desktop-first local web Showcase. shadcn/ui + Tailwind. Visual identity is `DESIGN.md`. Single operator (Ubuntu); no accounts.

Behavioral inspiration: Sales Incentives `packages/dev-dashboard` on **dev** (Overview, Features, Epics & Stories, Timeline, Tests, Docs, Search). Not a visual clone. No Sample World. No API nav.

## Information Architecture

Tree switcher lives in the sidebar brand (Current BMAD Trees only). Section nav below it.

| Surface | Reached from | Purpose |
|---|---|---|
| Overview | App open / nav | Counts and links for the selected Tree |
| Features | Nav | Feature/FR catalog extracted from planning Artifacts |
| Delivery | Nav “Epics & Stories” | Board or table of Epics and Stories |
| Timeline | Delivery view toggle (and `/timeline` alias) | Process-ordered rail, not a calendar |
| Tests | Nav | Catalog of tests that exist on disk |
| Docs | Nav | Catalog + Reader for remaining Artifacts |
| Epic / Story detail | Delivery, Timeline, Search | Reader for that Artifact |
| Search | ⌘K, `/`, header button | Full-text hits → matching surface |

Delivery and Timeline share one route with a view switch (board / table / timeline). Default view: **board**. Mocks: `mockups/overview.html`, `mockups/delivery.html`, `mockups/search.html`. Spines win on conflict.

**Not in v1 nav:** Data / Sample World (never). API, Blockers, Questions, Deferred (wanted later — do not design as if they ship in v1).

Every named need has a surface: trees (switcher), features (FR-13), epics/stories (FR-14), timeline (FR-15), tests (FR-16), docs/reader (FR-1–FR-6), search (FR-12), overview (FR-17).

## Voice and Tone

| Do | Don't |
|---|---|
| “No matches for FR-12.” | “We couldn’t find anything. Try a different search!” |
| “Unreadable Artifact.” | “Oops! Something went wrong.” |
| “No tests found.” | “Let’s add some Sample World fixtures!” |
| Kind names: Epic, Story, Feature, Test | “War Room”, “quests”, Sample World copy |

## Component Patterns

| Component | Use | Behavioral rules |
|---|---|---|
| Tree switcher | Sidebar brand | Current BMAD Trees only. Changes Overview/Features/Delivery/Tests/Docs context. |
| Section nav | Sidebar | Overview, Features, Epics & Stories, Tests, Docs. Active item uses `{colors.accent}` hairline, not a filled violet block. |
| Feature row | Features | Shows Feature/FR id, name, source Artifact. Click opens Reader on that Artifact. Filter by text. |
| Delivery board | Delivery | Columns from Story status when present (backlog → done). Cards open Story/Epic. Group by Epic or Story. |
| Delivery table | Delivery | Same data, tabular. |
| Timeline rail | Timeline | Vertical process order. Epic milestones; Stories as nodes. Open on click. Status color is semantic, not decorative. |
| Test row | Tests | Path or name; open source when a path exists. No Run button in v1. Catalog is repo-wide (tests live under `apps/`), filterable by selected Tree when a link exists. |
| Docs rail + Reader | Docs | Previous Catalog + Reader: Kind groups and markdown Reader. |
| Search palette | Overlay | ⌘K and `/`. Groups: Feature, Epic, Story, Test, Docs. Enter opens. Type chips optional. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Cold load | All | Short “Reading BMAD…” or skeletons |
| Empty Features / Delivery / Tests | That page | One line: “No Features in this Tree.” (etc.) |
| Missing Artifact | Reader | “Unreadable Artifact.” + reason |
| Search no matches | Search | “No matches for {query}.” |
| No tests | Tests | Empty state — do not invent Sample World cases |

## Interaction Primitives

- `⌘K` / `Ctrl+K` and `/` — Search
- `Enter` — open highlighted row or hit
- `Esc` — close Search
- Arrow keys — highlight in lists and Search
- View chips on Delivery: Board / Table / Timeline

Banned in v1: hover-only actions, drag-to-change-status, Sample World actions, API tab, modal stacks deeper than Search.

## Accessibility Floor

- Keyboard can complete UJ-1–UJ-7 without a mouse.
- Rendered markdown keeps heading ranks.
- Search results `aria-live`.
- Focus ring `{colors.accent}` on `{colors.background}`.
- WCAG AA target, not a formal audit gate.

## Responsive & Platform

| Breakpoint | Behavior |
|---|---|
| `≥ lg` | Sidebar + main |
| `< lg` | Sidebar becomes a sheet; usable, not a phone product |

## Inspiration & Anti-patterns

- **Lifted from SIS Dev Dashboard (dev):** section nav, Features catalog, Delivery board/table, process Timeline, Tests page, Docs explorer, ⌘K Search.
- **Rejected — Sample World / Data:** Ubuntu skip.
- **Later — API nav, Blockers, Questions, Deferred, test runner:** wanted; not v1. Leave sidebar room conceptually; do not add dead nav items in v1.
- **Rejected — SIS War Room grain / display serif:** we stay black, violet, Fira Code.
- **Rejected — writing status back to disk.**

## Key Flows

### Flow 1 — Epic to Story (UJ-1)

1. Ubuntu opens **dashboard**, Tree is `pocket-dimension`.
2. Opens Epics & Stories.
3. Opens an Epic, then a Story.
4. **Climax:** Story in Reader; way back via Delivery.

### Flow 2 — Docs (UJ-2)

1. Docs → Documentation Kind → architecture Artifact.
2. **Climax:** structured markdown, not a `<pre>` dump.

### Flow 3 — Dogfood (UJ-3)

1. Overview or Docs in `pocket-dimension`.
2. **Climax:** this PRD / UX pack is visible.

### Flow 4 — Search (UJ-4)

1. ⌘K, types an FR id.
2. **Climax:** Enter opens the Artifact.

### Flow 5 — Features (UJ-5)

1. Features → scans FR list → opens one.
2. **Climax:** Reader shows the defining PRD section.

### Flow 6 — Timeline (UJ-6)

1. Delivery → Timeline.
2. **Climax:** process rail; current Story opens.

### Flow 7 — Tests (UJ-7)

1. Tests → sees files that exist (e.g. zeo / chhan-chhan importers).
2. **Climax:** can open a listed path. Empty if none — no sample suite.
