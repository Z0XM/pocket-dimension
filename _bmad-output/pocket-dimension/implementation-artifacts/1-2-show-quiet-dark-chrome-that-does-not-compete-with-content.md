---
story_id: "1.2"
story_key: 1-2-show-quiet-dark-chrome-that-does-not-compete-with-content
epic: 1
depends_on: 1-1-run-dashboard-from-the-pocket-sibling-starter
baseline_commit: b5f43bba8aa4f260e5d19f71c57f5b8b8920bda4
---

# Story 1.2: Show quiet dark chrome that does not compete with content

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->
<!-- Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Ubuntu,
I want the Showcase to look like a finished dark internal tool,
so that chrome stays out of the way when I later read Artifacts.

## Acceptance Criteria

1. **Given** Story 1.1’s app is running  
   **When** I open any dashboard page  
   **Then** page background is DESIGN.md `{colors.background}` (`#0A0A0A`) and raised chrome uses `{colors.surface}` (`#111111`)  
   **And** the only brand accent is `{colors.accent}` (`#8B5CF6`), used for focus/selection, not as a sidebar or page fill  
   **And** body, labels, and titles are Fira Code at the DESIGN.md type ramp (no second typeface, not pocket Nunito)  
   **And** `src/app.css` holds these tokens and maps shadcn `primary` to accent  
   **And** chrome (nav, headers) is visually quieter than the main column (NFR-1, FR-11)

2. **Given** a desktop viewport `≥ lg`  
   **When** I view the shell  
   **Then** a left rail (~280px) sits beside a main column with 16px gutter  
   **And** below `lg` the rail becomes a sheet (usable, not a phone product)  
   **And** elevation is tonal + hairline (`{colors.border}`); no glass, no War Room grain, no gradients

3. **Given** keyboard focus  
   **When** I tab through chrome  
   **Then** the focus ring is accent on the dark background  
   **And** there are no hover-only actions

## Tasks / Subtasks

- [x] Replace pocket visual tokens with DESIGN.md brand layer in `src/app.css` (AC: 1, 3)
  - [x] Set exact hex tokens (do not keep pocket oklch purple-wash):
    - `--background: #0A0A0A`
    - `--surface` / raised chrome (`--card`, `--popover`, sidebar/chrome fills): `#111111`
    - `--foreground: #F5F5F5`
    - `--muted-foreground: #A3A3A3` (paths/meta; `--muted` fill may be surface-adjacent — do not invent a second accent family)
    - `--border: #262626`
    - `--accent: #8B5CF6` and `--accent-foreground: #FAFAFA`
    - `--destructive: #F87171`
    - **`--primary` = accent** (`#8B5CF6`); `--primary-foreground` = accent-foreground
    - `--ring` = accent (focus ring)
  - [x] Radius: DESIGN.md `{rounded.sm|md|lg}` → `4px` / `6px` / `8px` (set `--radius` so Tailwind radius tokens land on these; no pill chrome except future status chips)
  - [x] Type ramp as CSS vars or utility classes used by shell:
    - body: 14px / 400 / 1.6
    - label: 12px / 500 / 1.4
    - display: 20px / 500 / 1.3
  - [x] Map `@theme inline` so Tailwind `bg-background`, `text-foreground`, `border-border`, `bg-primary`, `ring-ring`, `font-sans`/`font-mono` resolve to the above
  - [x] Body default: Fira Code + `bg-background` + `text-foreground`. No antialiased “marketing” glow required
  - [x] Do **not** add a second token file. Tokens live only in `src/app.css`

- [x] Swap fonts to Fira Code only (AC: 1)
  - [x] Add `@fontsource/fira-code` (weights **400** and **500** — body vs label/display). Prefer static package so CSS `font-family: "Fira Code"` matches DESIGN.md exactly. Variable (`@fontsource-variable/fira-code`) is acceptable only if the family string still presents as Fira Code and no second face remains
  - [x] Remove `@fontsource-variable/nunito-sans` and `@fontsource/fira-mono` from `package.json` and from `src/routes/+layout.ts` (or wherever fonts are imported)
  - [x] Set `--font-sans` and `--font-mono` (and body `font-family`) to **Fira Code** only — one family for chrome and content. No Nunito, no second display face, no serif “literary” moment
  - [x] Run `bun install` at repo root after dependency change

- [x] Build quiet app shell chrome (AC: 1, 2, 3)
  - [x] Add `$lib/components/app-shell.svelte` (kebab-case; architecture product component)
  - [x] `≥ lg`: left rail ~`280px` (`DESIGN.md` `{spacing.rail}`) + main column; page gutter `16px` (`{spacing.gutter}`)
  - [x] Rail uses surface (or background + hairline border) — **quieter** than main; never fill rail with accent
  - [x] `< lg`: rail content moves into existing shadcn **Sheet** (already added in 1.1). Usable; not a phone redesign. Trigger is a visible control (button), not hover-only
  - [x] Elevation: tonal (`background` vs `surface`) + `border` hairline only. **Delete** pocket layout gradients / blur orbs from `+layout.svelte`
  - [x] Wire `+layout.svelte` to render `app-shell` around `{@render children()}`. Keep `import "../app.css"`
  - [x] Placeholder chrome is OK: brand label “dashboard”, static muted section labels (Overview / Features / Epics & Stories / Tests / Docs) as **non-routing** or inert structure. Do **not** implement Tree switcher data (Story 1.3), Overview counts (1.4), Search overlay, or Reader
  - [x] If nav links are real `<a href>`, they must not be the only way to discover actions that lack a keyboard path — and do not invent §6.3 routes (API, Blockers, Sample World)
  - [x] Soften `+page.svelte`: drop pocket-scale `text-4xl`/`text-5xl` hero and loud dashed “card” treatment; use display/body ramp so the main column reads as content, chrome as chrome

- [x] Focus and interaction guardrails (AC: 3)
  - [x] Focus ring uses `--ring` / accent on dark (`outline` / `ring-ring`); verify tabbing through shell trigger + any focusable chrome
  - [x] No hover-only actions (EXPERIENCE.md ban). Menu open, sheet open, and any control must work with keyboard / click
  - [x] Do not restyle every shadcn primitive into a custom kit — inherit anatomy; brand layer is tokens only

- [x] Preserve Story 1.1 runtime contract (regression)
  - [x] Keep `src/routes/health/+server.ts` → `{ status: "ok" }`
  - [x] Port **3011**, no auth-service, no PostgreSQL, no `DATABASE_URL`, no write product APIs
  - [x] Do not edit `apps/pocket/**` or rhymes `sprint-status.yaml`

- [x] Verify (AC: 1–3)
  - [x] `bun run dev:app:dashboard` on 3011
  - [x] Visual / DevTools: computed `body` background ≈ `#0A0A0A`; no Nunito in computed font-family; accent not used as page/sidebar fill
  - [x] Resize across `lg`: rail vs sheet
  - [x] Tab through chrome: accent focus ring visible
  - [x] `curl -sS http://localhost:3011/health` still `{"status":"ok"}`
  - [x] `bun run check` in `apps/dashboard` (or filter) passes after sync

## Dev Notes

### Scope boundary (critical)

This story is **chrome + tokens only** (FR-11, UX-DR1–DR3, UX-DR15–DR16 layout/a11y bits).

| In scope | Out of scope (later stories) |
| --- | --- |
| DESIGN.md tokens in `app.css` | Tree allow-list / `bmad-root.ts` (1.3) |
| Fira Code only | `?tree=` URL truth (1.3) |
| `app-shell` rail + sheet | Overview counts + real section routes (1.4) |
| Remove pocket gradients | Docs/Reader/markdown (Epic 2) |
| Focus ring; no hover-only | Search ⌘K (Epic 4), Delivery (Epic 3) |

Do not invent War Room grain, glass, second accent, or SIS React patterns.

### Current UPDATE files (read before editing)

State after Story 1.1 (`apps/dashboard` copied from pocket, hub stripped, shadcn wired):

| File | Current state | This story changes | Must preserve |
| --- | --- | --- | --- |
| `apps/dashboard/src/app.css` | Pocket-ish oklch tokens; `--font-sans: Nunito Sans Variable`; `--font-mono: Fira Mono`; body `font-sans` | Replace with DESIGN.md hex set; `primary` = accent; Fira Code as the only face; type ramp; radius sm/md/lg | Tailwind 4 + tw-animate imports; `@theme inline` wiring pattern; single token file |
| `apps/dashboard/src/routes/+layout.ts` | Imports Nunito + Fira Mono + `app.css` | Import Fira Code (400/500); drop Nunito/Fira Mono | Side-effect font + css load pattern |
| `apps/dashboard/src/routes/+layout.svelte` | Pocket decorative **radial gradients / blur orbs** + centered `max-w-5xl` column | Replace with `app-shell` (rail + main); **delete gradients** | `{@render children()}`; import css; no auth |
| `apps/dashboard/src/routes/+page.svelte` | Placeholder “dashboard” with large heading + dashed card | Quiet content column using type ramp; not a marketing hero | Title still dashboard; not Pocket hub tiles |
| `apps/dashboard/package.json` | `@fontsource-variable/nunito-sans`, `@fontsource/fira-mono` | Swap to `@fontsource/fira-code`; remove Nunito/Fira Mono | Name `@pocket-dimension/dashboard`; scripts; bits-ui; no auth/db deps |
| `apps/dashboard/components.json` | watchlist aliases; css `src/app.css` | Usually untouched | Keep aliases / registry |
| `apps/dashboard/src/lib/components/ui/sheet/*` | Present from 1.1 | Use for `< lg` rail — do not reimplement | shadcn anatomy |
| `apps/dashboard/src/routes/health/+server.ts` | `{ status: "ok" }` | **Do not change** | Health contract |
| `apps/dashboard/vite.config.ts` / `.env.example` | PORT from env; 3011 | **Do not change** port/auth | 3011 standalone |

**NEW file expected:** `apps/dashboard/src/lib/components/app-shell.svelte`. Optional thin helpers: `section-nav.svelte` presentational stubs only (full UX-DR6 wiring is Story 1.4).

### Token mapping (copy exactly)

From DESIGN.md frontmatter / UX-DR1:

```css
/* Conceptual — place in :root (html already has class="dark" in app.html) */
--background: #0A0A0A;
--surface: #111111;          /* also drive --card / --popover / chrome fills */
--foreground: #F5F5F5;
--muted-foreground: #A3A3A3;
--border: #262626;
--accent: #8B5CF6;
--accent-foreground: #FAFAFA;
--destructive: #F87171;
--primary: var(--accent);    /* or #8B5CF6 */
--primary-foreground: var(--accent-foreground);
--ring: var(--accent);
```

Avoid: neon violet, gradients, colored Reader/page wash, accent as sidebar fill, pocket oklch hue drift.

### Layout targets

- Rail: ~280px; gutter: 16px; Tailwind `lg` ≈ 1024px (EXPERIENCE.md / UX-DR16)
- Mock spine: `planning-artifacts/ux-designs/ux-dashboard-2026-08-23/mockups/overview.html` (aside 280px, hairline border, active row = surface + accent left hairline — active styling fully required when real nav lands in 1.4; in 1.2 at least do not use filled violet blocks if you show an “active” demo row)
- Reader max-width 48rem is **not** required until Reader exists; do not fake a Reader

### Architecture compliance

- Stack unchanged: Svelte 5 / SvelteKit 2 / Bun / Tailwind 4 / shadcn-svelte / bits-ui
- Product Svelte: kebab-case under `$lib/components/`
- No `shared/dashboard`, no DB, no Better Auth, no Sample World
- FR-11 maps to `app.css` + `app-shell` (+ later `section-nav`) — [Source: architecture-dashboard.md — Requirements to Structure Mapping]
- Named absences stay absent: War Room grain, glass, Blockers/API nav, hover-only actions

### Library / framework requirements

- Font: `@fontsource/fira-code` (400 + 500). Do not upgrade Svelte/Kit/Tailwind “to latest” casually — match monorepo sibling ranges from 1.1
- Sheet: existing `$lib/components/ui/sheet`
- No MiniSearch, no remark pipeline, no fs allow-list in this story

### Project Structure Notes

```
apps/dashboard/src/
  app.css                 # UPDATE — DESIGN.md tokens + Fira Code theme
  app.html                # keep class="dark"; title dashboard
  routes/
    +layout.ts            # UPDATE — font imports
    +layout.svelte        # UPDATE — app-shell; kill gradients
    +page.svelte          # UPDATE — quiet placeholder
    health/+server.ts     # PRESERVE
  lib/components/
    app-shell.svelte      # NEW
    ui/sheet/…            # USE
```

Conflict note: pocket layout aesthetics (gradient wash) contradict DESIGN.md Elevation. Removing them is required, not optional polish.

### Previous story intelligence (1.1)

- Sibling copy from pocket succeeded; hub stripped; shadcn primitives including **sheet** already installed
- Story 1.1 explicitly deferred DESIGN.md hex / Fira Code to **this** story
- `bun run --filter=@pocket-dimension/dashboard check` had ENOENT at root; run `bun run check` **inside** `apps/dashboard`
- Deploy Dockerfile/railpack were deleted — do not resurrect
- Do not touch `apps/pocket` or rhymes `sprint-status.yaml`
- Placeholder `/` must remain non-hub

### Git intelligence

Recent relevant commits:

- `b5f43bb` — dashboard scaffold (story 1.1): `apps/dashboard/**`, root turbo scripts, sprint-status-dashboard
- `630dce2` — dashboard PRD/UX/architecture/epics planning docs

Implement against the tree as of 1.1 done; do not re-scaffold.

### Latest tech information

- `@fontsource/fira-code` current line is 5.x; import e.g. `@fontsource/fira-code/400.css` and `/500.css`, then `font-family: "Fira Code", ui-monospace, monospace`
- shadcn-svelte tokens: mapping `--primary` to accent is the brand-layer delta; do not regenerate all UI components unless a token rename breaks types (unlikely)

### Testing requirements

Manual / curl (no parser tests):

```bash
bun install
bun run dev:app:dashboard
curl -sS http://localhost:3011/health
# Browser: http://localhost:3011 — check bg #0A0A0A, Fira Code, rail ≥lg, sheet <lg, tab focus ring
cd apps/dashboard && bun run check
```

Fail if: Nunito still loads; purple gradient/orb backdrop remains; accent fills the sidebar; hover-only sheet control; health broken; port ≠ 3011.

### Anti-patterns (do not)

- Keep or reintroduce Nunito / Fira Mono as a second face
- Accent sidebar or page gradient “brand moments”
- Glass / backdrop-blur hierarchy / War Room grain
- Implementing Tree switcher filesystem logic or Overview counts
- Auth, DB, write APIs, Sample World
- Editing rhymes `sprint-status.yaml` or `epics.md` / `architecture.md` (non-dashboard)
- Restyling every shadcn primitive beyond token inheritance
- Cards as the primary chrome language (placeholder content may be plain text)

### References

- [Source: planning-artifacts/epics-dashboard.md — Story 1.2, Epic 1, UX-DR1–DR3, UX-DR15–DR16, FR-11]
- [Source: planning-artifacts/architecture-dashboard.md — Frontend Architecture chrome; Project Structure `app.css` / `app-shell.svelte`; FR-11 mapping]
- [Source: planning-artifacts/ux-designs/ux-dashboard-2026-08-23/DESIGN.md — colors, typography, spacing.rail/gutter, elevation]
- [Source: planning-artifacts/ux-designs/ux-dashboard-2026-08-23/EXPERIENCE.md — Responsive & Platform; Interaction bans; Accessibility Floor]
- [Source: planning-artifacts/ux-designs/ux-dashboard-2026-08-23/mockups/overview.html — 280px rail spine]
- [Source: planning-artifacts/prds/prd-dashboard-2026-08-23/prd.md — FR-11, NFR-1]
- [Source: planning-artifacts/prds/prd-dashboard-2026-08-23/addendum.md — visual tokens]
- [Source: implementation-artifacts/1-1-run-dashboard-from-the-pocket-sibling-starter.md — deferred tokens; sheet already added]
- [Source: apps/dashboard/src/app.css, +layout.svelte, +layout.ts, +page.svelte, package.json — current UPDATE baselines]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Replaced pocket oklch tokens with DESIGN.md hex brand layer in `app.css`; `--primary` and `--ring` map to accent; type ramp utilities (`text-label`, `text-display`) added.
- Swapped Nunito Sans + Fira Mono for `@fontsource/fira-code` (400/500); single Fira Code family for chrome and content.
- Added `app-shell.svelte`: 280px left rail at `lg+`, sheet + visible Navigation button below `lg`; removed pocket gradients/blur from layout; quiet placeholder page content.
- Verified: `bun run check` (0 errors), `curl localhost:3011/health` → `{"status":"ok"}`, desktop/mobile screenshots confirm dark chrome, rail/sheet responsive behavior, accent only on active row left border.

### File List

- apps/dashboard/src/app.css
- apps/dashboard/src/routes/+layout.ts
- apps/dashboard/src/routes/+layout.svelte
- apps/dashboard/src/routes/+page.svelte
- apps/dashboard/src/lib/components/app-shell.svelte
- apps/dashboard/package.json
- bun.lock

## Change Log

- 2026-08-23: Story 1.2 context created (ready-for-dev) — quiet dark chrome / DESIGN.md tokens / Fira Code / app-shell.
- 2026-08-23: Implemented quiet dark chrome — DESIGN.md tokens, Fira Code-only typography, app-shell rail/sheet, removed pocket decorative layout.
