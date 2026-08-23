---
story_id: "1.4"
story_key: 1-4-land-on-overview-for-the-selected-tree
epic: 1
depends_on: 1-3-switch-among-current-bmad-trees-only
baseline_commit: ca51c292366a9a74d5a6305434739e290508a4f0
---

# Story 1.4: Land on Overview for the selected Tree

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->
<!-- Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Ubuntu,
I want to open dashboard on a thin Overview of the selected Tree,
so that I can jump to Features, Delivery, Tests, or Docs without hunting folders.

## Acceptance Criteria

1. **Given** a Current BMAD Tree is selected (Story 1.3)  
   **When** I open `/`  
   **Then** Overview names that Tree and does not list leftover Trees (FR-17, UX-DR7)  
   **And** Overview links to Features, Delivery, Tests, and Docs  
   **And** a short cold load (“Reading BMAD…” or skeletons) may appear; no global spinner that blocks chrome (UX-DR14)

2. **Given** the sidebar  
   **When** I look at section nav  
   **Then** the only items are Overview, Features, Epics & Stories, Tests, Docs (UX-DR6)  
   **And** there are no nav items for Data, Sample World, API, Blockers, Questions, or Deferred  
   **And** the active item uses an accent left hairline, not a filled violet block  
   **And** those routes exist so the links do not 404; pages that Epic 2–4 will fill may show the matching empty copy (e.g. “No Features in this Tree.”)

3. **Given** I switch Tree  
   **When** Overview reloads  
   **Then** the name and links are for the new Tree  
   **And** counts, if shown, are from disk for this Tree only (not leftover trees, not Sample World). Kind-accurate Feature/Epic/Test counts may stay 0 until later epics classify Artifacts

## Tasks / Subtasks

- [x] Add section nav registry + product component (AC: 2)
  - [x] **NEW** `apps/dashboard/src/lib/nav.ts` — single source of truth for section list (architecture: `nav.ts`; no §6.3 items)
  - [x] Exact labels + hrefs (copy order):
    | Label | Path |
    | --- | --- |
    | Overview | `/` |
    | Features | `/features` |
    | Epics & Stories | `/delivery` |
    | Tests | `/tests` |
    | Docs | `/docs` |
  - [x] **NEW** `apps/dashboard/src/lib/components/section-nav.svelte` — renders those five as real `<a>` links (or SvelteKit `data-sveltekit-*` links)
  - [x] Preserve `?tree=` on every section href when a tree is selected (URL is source of truth from 1.3). Example: `/features?tree=zeo`
  - [x] Active item: match `page.url.pathname` (Overview = `/` exactly; others = path prefix or exact). Style = `border-l-2 border-accent` + surface/`bg-card` fill + foreground text — **not** `bg-accent` / filled violet block (UX-DR4 / EXPERIENCE section nav)
  - [x] Inactive: transparent left border + muted text (match `tree-switcher` pattern)
  - [x] Keyboard operable (native links). No hover-only navigation. Close mobile sheet on navigate if practical
  - [x] **UPDATE** `app-shell.svelte`: replace inert `sections` `<span>` list in **both** desktop rail and `< lg` sheet with `<SectionNav {tree} />` (or pass pathname). Keep brand “dashboard”, `TreeSwitcher`, BMAD Root empty/error block, DESIGN tokens

- [x] Thin Overview landing at `/` (AC: 1, 3)
  - [x] **UPDATE** `apps/dashboard/src/routes/+page.svelte` into FR-17 Overview (replace Story 1.3 placeholder copy)
  - [x] Display title / primary name = **selected Tree id** (e.g. `pocket-dimension`), not a leftover folder list and not a second brand hero that overpowers chrome
  - [x] Provide clear links to Features, Delivery (`/delivery`), Tests, and Docs — same destinations as section nav; preserve `?tree=`
  - [x] Counts are **optional**. If shown: derive only from the selected Tree on disk for this request; never hardcode mockup numbers (12/5/24 from `overview.html` are visual inspiration only). Kind-accurate Feature/Epic/Test counts **may be 0** until Epic 2–4 classifiers exist — showing 0 or omitting counts is correct; inventing Sample World counts is not
  - [x] Prefer a quiet link list / tonal rows over card-grid clutter; mockup cards are optional skeleton of IA, not a requirement to ship three count tiles
  - [x] When `tree` is null / BMAD Root error: do not invent an Overview corpus — shell already shows “BMAD Root unavailable.”; Overview may stay minimal or empty
  - [x] Cold load (UX-DR14): optional brief “Reading BMAD…” or skeleton in the **main column only** during navigational pending; chrome (rail / sheet / switcher / section nav) must remain visible — **no** full-viewport global spinner that blocks chrome

- [x] Stub section routes so nav does not 404 (AC: 2)
  - [x] **NEW** `apps/dashboard/src/routes/features/+page.svelte` — honest empty: **“No Features in this Tree.”** (EXPERIENCE / UX-DR14). Optional one muted body line naming the selected `tree`. No Feature extractor, no Reader
  - [x] **NEW** `apps/dashboard/src/routes/delivery/+page.svelte` — empty: e.g. **“No Epics & Stories in this Tree.”** (or “No Delivery items in this Tree.”). No board/table/timeline UI yet; no `?view=` wiring required beyond accepting the route
  - [x] **NEW** `apps/dashboard/src/routes/tests/+page.svelte` — empty: **“No Tests in this Tree.”** or EXPERIENCE “No tests found.” Prefer Tree-scoped phrasing consistent with Features empty. No `apps/**` test scanner
  - [x] **NEW** `apps/dashboard/src/routes/docs/+page.svelte` — empty Docs landing: one display line + optional reason (e.g. “No Docs in this Tree.” / “Docs catalog arrives in Epic 2.”). No Kind groups, no markdown Reader, no `[...path]` yet
  - [x] Each stub page: `<svelte:head>` title quiet (`dashboard · Features` etc. OK); use display/body type ramp; no illustrations; no Sample World CTAs
  - [x] Pages read `tree` from layout `data` (already loaded) — do **not** re-walk BMAD Root in each stub unless needed; no `{ data, error }` envelope

- [x] Tree switch ↔ Overview continuity (AC: 3)
  - [x] Keep Story 1.3 `tree-switcher` behavior: `goto` updates `?tree=` and **preserves pathname** (do not force-redirect every switch to `/` unless already on `/`)
  - [x] When pathname is `/`, switching Tree must refresh Overview name/links for the new Tree via layout load (request-time; no watcher)
  - [x] When on a stub section, switching Tree keeps that section and updates empty copy context for the new Tree (still no leftover trees)

- [x] Preserve Epic 1 contracts (regression)
  - [x] Health `GET /health` → `{"status":"ok"}`; port **3011**; no auth/DB; no write APIs
  - [x] Closed allow-list + `bmad-root.ts` unchanged in behavior
  - [x] DESIGN.md tokens + Fira Code + rail/sheet chrome unchanged
  - [x] Do **not** edit `apps/pocket/**`, rhymes `sprint-status.yaml`, non-dashboard `epics.md` / `architecture.md`

- [x] Verify (AC: 1–3)
  - [x] `cd apps/dashboard && bun run check`
  - [x] `cd apps/dashboard && bun test src` (existing `bmad-root` tests still pass; add nav unit test only if `nav.ts` logic is non-trivial)
  - [x] `bun run dev:app:dashboard` — open `/` → Overview names selected tree; section nav five items only; click each → no 404; empty copy present
  - [x] Switch `?tree=zeo` on Overview → name/links for zeo
  - [x] Active nav hairline on current route; no filled violet nav blocks; no Data/API/Blockers/Questions/Deferred/Sample World items
  - [x] `curl -sS http://localhost:3011/health` still OK

## Dev Notes

### Scope boundary (critical)

This is the **last Epic 1 story**. It closes FR-17 + section IA wiring. It does **not** implement real catalogs.

| In scope | Out of scope (later) |
| --- | --- |
| Overview thin landing naming selected Tree | `read-tree.ts` full snapshot / classifier (Epic 2) |
| `nav.ts` + `section-nav.svelte` live links | Features extract / Feature rows (Epic 3 / 2.x) |
| Stub `/features`, `/delivery`, `/tests`, `/docs` with honest empty copy | Delivery board/table/timeline + `?view=` (Epic 3) |
| Preserve `?tree=` on section links | Docs Kind groups + Reader + sanitize pipeline (Epic 2) |
| Optional counts = 0 or disk-thin only | Tests catalog under `apps/**` (Epic 4) |
| Cold load copy without blocking chrome | Search ⌘K / `search-overlay` / `keyboard.ts` (Epic 4) |
| | `/timeline` redirect, `/epics/[id]`, `/stories/[id]`, `/docs/[...path]` |
| | Blockers / Questions / Deferred / API / Sample World nav |
| | Markdown remark pipeline, MiniSearch, file watcher |

Do **not** implement real Docs/Features/Delivery/Tests catalogs in this story — stub routes with honest empty copy are explicitly in-scope.

### Current UPDATE / NEW files (read before editing)

State after Story 1.3 (`baseline_commit` ≈ `ca51c29`):

| File | Current state | This story changes | Must preserve |
| --- | --- | --- | --- |
| `apps/dashboard/src/lib/components/app-shell.svelte` | Rail + sheet; `TreeSwitcher`; **inert** `sections` spans always marking Overview active (`index === 0`) | Mount `section-nav`; remove hard-coded inert list | Brand, switcher, BMAD Root error block, tokens, sheet trigger |
| `apps/dashboard/src/routes/+page.svelte` | Placeholder: “Selected tree: … Overview … arrive in Story 1.4” | Real thin Overview (FR-17) | Quiet type ramp; no hub tiles |
| `apps/dashboard/src/routes/+layout.server.ts` | `{ trees, tree, bmadRootError }` | Usually **untouched** (enough for Overview + stubs). Optional later fields stay deferred |
| `apps/dashboard/src/routes/+layout.svelte` | Passes tree data into `AppShell` | Untouched unless shell props change | `{@render children()}` |
| `apps/dashboard/src/lib/components/tree-switcher.svelte` | `goto` + preserve pathname + `?tree=` | Prefer **untouched**; still preserves pathname | URL truth; hairline active; no sessionStorage |
| `apps/dashboard/src/lib/types.ts` | `TreeId`, `LayoutTreeData` | Extend only if Overview DTO needs fields | Existing tree types |
| `apps/dashboard/src/app.css` / fonts | DESIGN.md + Fira Code | **Do not restyle** | Hex brand layer |
| `apps/dashboard/src/routes/health/+server.ts` | `{ status: "ok" }` | **Do not change** | Health contract |

**NEW (required):**

| File | Role |
| --- | --- |
| `src/lib/nav.ts` | Section registry (label, href); no §6.3 |
| `src/lib/components/section-nav.svelte` | Active hairline links; preserve `tree` query |
| `src/routes/features/+page.svelte` | Empty Features stub |
| `src/routes/delivery/+page.svelte` | Empty Delivery stub |
| `src/routes/tests/+page.svelte` | Empty Tests stub |
| `src/routes/docs/+page.svelte` | Empty Docs stub |

**Do not create yet:** `read-tree.ts`, `classify.ts`, `markdown.ts`, `features.ts`, `delivery.ts`, `tests-catalog.ts`, `search-overlay.svelte`, `markdown-reader.svelte`, `feature-row.svelte`, `delivery-*.svelte`, `test-row.svelte`, `keyboard.ts`, `/docs/[...path]`, `/epics/[id]`, `/stories/[id]`, `/timeline`.

### Architecture compliance

- Routes (this story subset): `/` Overview, `/features`, `/delivery`, `/tests`, `/docs` — [Source: architecture-dashboard.md — Frontend Architecture / Project Structure]
- Nav label **“Epics & Stories”** → path **`/delivery`** (EXPERIENCE IA table)
- Query key `tree` lowercase; values `pocket-dimension` \| `zeo` \| `chhan-chhan`
- Product components kebab-case under `$lib/components/`; `nav.ts` at `$lib/nav.ts`
- Flat load DTOs (pocket style); no `{ data, error }` envelope
- Layout freshness: request-time; no file watcher (NFR-6)
- Named absences: Sample World, API nav, Blockers, Questions, Deferred, write-back, auth
- Empty classified set copy: “No Features in this Tree.” (etc.) — [Source: architecture Process Patterns]
- Cold load: “Reading BMAD…” or skeletons; no global spinner that blocks chrome
- Authorization remains allow-list + realpath in `$lib/server` only — stubs must not `fs` from components

### Library / framework requirements

- Stack unchanged: Svelte 5 runes, SvelteKit 2 (`^2.49.1`), Bun, Tailwind 4, shadcn already present
- Prefer `$app/state` `page` **or** existing `$app/stores` pattern already used in `tree-switcher.svelte` — stay consistent within the app; do not mix arbitrarily in one component without reason
- Build section URLs with `URL` / `searchParams` (same as tree-switcher) so `tree` is never dropped
- Do **not** add remark, MiniSearch, Drizzle, Better Auth, or new UI libraries for this story
- Tests: `bun:test` only if adding pure `nav.ts` helpers; no Playwright required

### Project Structure Notes

```
apps/dashboard/src/
  lib/
    nav.ts                       # NEW — section registry
    types.ts                     # PRESERVE / minor extend
    server/
      bmad-root.ts               # PRESERVE
      bmad-root.test.ts          # PRESERVE
    components/
      app-shell.svelte           # UPDATE — SectionNav
      tree-switcher.svelte       # PRESERVE
      section-nav.svelte         # NEW
  routes/
    +layout.server.ts            # PRESERVE (trees/tree)
    +layout.svelte               # PRESERVE
    +page.svelte                 # UPDATE — Overview FR-17
    features/+page.svelte        # NEW stub
    delivery/+page.svelte        # NEW stub
    tests/+page.svelte           # NEW stub
    docs/+page.svelte            # NEW stub
    health/+server.ts            # PRESERVE
```

Conflict note: mockup `overview.html` shows count cards with invented numbers — **do not** ship fake counts. Architecture + epic AC allow 0 until classifiers exist.

Conflict note: `app-shell` currently forces Overview as always-active (`index === 0`). That is wrong after routing lands — active state must follow pathname.

### Previous story intelligence (1.1 → 1.3)

- **1.1:** pocket sibling on **3011**; hub stripped; shadcn (sheet/button/…) installed; deploy files deleted — do not resurrect
- **1.2:** DESIGN.md tokens + Fira Code; `app-shell` rail/sheet; section labels were **placeholders** deferred to 1.4 for real routes
- **1.3:** closed allow-list `bmad-root.ts`; `+layout.server.ts` → `{ trees, tree, bmadRootError }`; `tree-switcher` URL `?tree=`; Overview deferred explicitly to **this** story; inert nav left for 1.4
- 1.3 completion: `bun test src` (8 tests) + `bun run check` clean; Vite SSR walk-up uses `import.meta.url` / cwd fallback — do not break `bmad-root`
- Run check/test **inside** `apps/dashboard`
- Dashboard tracking only: `sprint-status-dashboard.yaml` (not rhymes `sprint-status.yaml`)

### Git intelligence

Recent commits on `cursor/dashboard-epic-1-66a2`:

- `ca51c29` — story 1.3 allow-list trees + switcher + layout load
- `fcc8d37` — story 1.2 quiet dark chrome
- `630dce2` / `b5f43bb` — planning + story 1.1 scaffold

Implement atop 1.3 tree; do not re-scaffold, re-token, or re-open allow-list design.

### Latest tech information

- SvelteKit 2: use `goto` / `<a href>` with full path+query; do not mutate `page.url.searchParams` in place expecting reactivity
- Active nav: compare `pathname` (`/` vs `/features` …); trailing-slash config follows app default (pocket sibling typically no trailing slash)
- Optional `navigating` from `$app/stores` / `$app/state` for “Reading BMAD…” in main only — never replace the shell
- Keep `@sveltejs/kit` / Svelte ranges aligned with monorepo siblings

### Testing requirements

Automated:

```bash
cd apps/dashboard
bun test src          # existing bmad-root tests must pass
bun run check         # types clean with new routes + section-nav
```

Optional: small `nav.test.ts` asserting exactly five sections and forbidden labels absent (`Data`, `Sample World`, `API`, `Blockers`, `Questions`, `Deferred`).

Manual:

```bash
bun run dev:app:dashboard
# / → Overview titles selected tree; links to four surfaces
# Sidebar: Overview, Features, Epics & Stories, Tests, Docs only
# Each nav click → 200 + empty copy; no 404
# ?tree=zeo on / → Overview shows zeo; switch back to pocket-dimension
# Active item: accent left hairline + surface, not violet fill
curl -sS http://localhost:3011/health   # {"status":"ok"}
```

Fail if: §6.3 nav items appear; routes 404; Sample World / fake counts; global blocking spinner; Features/Docs/Delivery/Tests real catalogs implemented; health/port/auth regressions; `?tree=` dropped on section links; leftover trees listed on Overview.

### Anti-patterns (do not)

- Hardcoding mockup counts (12 Features / 5 Epics / 24 Stories)
- Nav items for Data, Sample World, API, Blockers, Questions, Deferred
- Filled violet / `bg-accent` active nav blocks
- Global full-page spinner covering chrome
- Implementing classify / remark / Delivery board / Search / test scanner “while here”
- `sessionStorage` for tree or section
- File watcher
- Editing rhymes `sprint-status.yaml` or non-dashboard epics/architecture
- Leaving Overview as “arrives in Story 1.4” placeholder
- Forcing tree switch to always `goto('/')` if that breaks 1.3 preserve-pathname contract (Overview must still update when already on `/`)

### Empty / error / loading copy (EXPERIENCE voice)

| State | Copy |
| --- | --- |
| Cold load | “Reading BMAD…” or skeletons (main column) |
| Empty Features | “No Features in this Tree.” |
| Empty Delivery | “No Epics & Stories in this Tree.” (acceptable variant: “No Delivery items in this Tree.”) |
| Empty Tests | “No Tests in this Tree.” / “No tests found.” |
| Empty Docs (stub) | “No Docs in this Tree.” (+ optional short reason) |
| BMAD Root missing | Keep shell: “BMAD Root unavailable.” + reason (1.3) |

Do **not**: “Oops!”, marketing filler, Sample World offers, “War Room” / “quests”.

### References

- [Source: planning-artifacts/epics-dashboard.md — Story 1.4, Epic 1, FR-17, UX-DR6, UX-DR7, UX-DR14]
- [Source: planning-artifacts/architecture-dashboard.md — routes `/` `/features` `/delivery` `/tests` `/docs`; `nav.ts`; `section-nav.svelte`; Overview FR-17; empty/loading patterns; Project Structure]
- [Source: planning-artifacts/ux-designs/ux-dashboard-2026-08-23/EXPERIENCE.md — IA table; section nav; empty/cold load; bans]
- [Source: planning-artifacts/ux-designs/ux-dashboard-2026-08-23/DESIGN.md — active hairline; rail; type ramp]
- [Source: planning-artifacts/ux-designs/ux-dashboard-2026-08-23/mockups/overview.html — visual IA only; not count truth]
- [Source: planning-artifacts/prds/prd-dashboard-2026-08-23/prd.md — FR-17; §5 non-goals Sample World / API / Blockers]
- [Source: planning-artifacts/prds/prd-dashboard-2026-08-23/addendum.md — SIS surfaces taken vs excluded]
- [Source: implementation-artifacts/1-3-switch-among-current-bmad-trees-only.md — trees/tree load; deferred Overview + section routes]
- [Source: implementation-artifacts/1-2-show-quiet-dark-chrome-that-does-not-compete-with-content.md — app-shell baseline; placeholder nav]
- [Source: apps/dashboard/src/lib/components/app-shell.svelte — UPDATE baseline inert sections]
- [Source: apps/dashboard/src/routes/+page.svelte — UPDATE baseline placeholder]
- [Source: apps/dashboard/src/routes/+layout.server.ts — trees/tree DTO]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Added `nav.ts` registry (five sections only) and `section-nav.svelte` with accent hairline active state, `?tree=` preservation, and mobile sheet close on navigate.
- Replaced Overview placeholder with thin FR-17 landing naming selected tree and linking to Features/Delivery/Tests/Docs.
- Stub routes at `/features`, `/delivery`, `/tests`, `/docs` with honest empty copy; no fake counts or catalogs.
- `bun test src`: 15 pass (8 bmad-root + 7 nav). `bun run check`: 0 errors. Dev server: all routes 200, health OK.

### File List

- apps/dashboard/src/lib/nav.ts
- apps/dashboard/src/lib/nav.test.ts
- apps/dashboard/src/lib/components/section-nav.svelte
- apps/dashboard/src/lib/components/app-shell.svelte
- apps/dashboard/src/routes/+page.svelte
- apps/dashboard/src/routes/features/+page.svelte
- apps/dashboard/src/routes/delivery/+page.svelte
- apps/dashboard/src/routes/tests/+page.svelte
- apps/dashboard/src/routes/docs/+page.svelte
- _bmad-output/pocket-dimension/implementation-artifacts/1-4-land-on-overview-for-the-selected-tree.md
- _bmad-output/pocket-dimension/implementation-artifacts/sprint-status-dashboard.yaml

## Change Log

- 2026-08-23: Story 1.4 context created (ready-for-dev) — Overview landing, section-nav routes, stub Features/Delivery/Tests/Docs empty states.
- 2026-08-23: Story 1.4 implemented — section nav, Overview landing, stub routes; Epic 1 complete.
