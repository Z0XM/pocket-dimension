---
story_id: "1.3"
story_key: 1-3-switch-among-current-bmad-trees-only
epic: 1
depends_on: 1-2-show-quiet-dark-chrome-that-does-not-compete-with-content
baseline_commit: fcc8d3708b99894847eb29e3825fb334b033b6d0
---

# Story 1.3: Switch among Current BMAD Trees only

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->
<!-- Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Ubuntu,
I want to pick `pocket-dimension`, `zeo`, or `chhan-chhan`,
so that I only see living BMAD Trees, not leftover folders.

## Acceptance Criteria

1. **Given** `_bmad-output/README.md` names Current BMAD Trees (`pocket-dimension`, `zeo`, `chhan-chhan`)  
   **When** the shell loads  
   **Then** the Tree switcher lists exactly those trees that exist on disk at read time (FR-1, UX-DR5)  
   **And** a leftover first-level folder under `_bmad-output/` does not appear  
   **And** `bmad-root.ts` finds the repo by walking up from `import.meta.dir` / cwd until `_bmad-output/` exists  
   **And** paths are `realpath`-resolved; anything outside the allow-list is not served

2. **Given** I select a tree in the switcher  
   **When** the URL updates  
   **Then** `?tree=` is one of `pocket-dimension` | `zeo` | `chhan-chhan`  
   **And** a refresh restores that tree  
   **And** an invalid or missing `tree` value falls back to the first allow-listed tree, not a leftover folder

3. **Given** I add or remove a Current BMAD Tree on disk  
   **When** I navigate or reload  
   **Then** the switcher reflects the new set (no file watcher)

4. **Given** `_bmad-output` is missing or unreadable  
   **When** I open dashboard  
   **Then** I see an honest empty/error state, not Sample World data

## Tasks / Subtasks

- [x] Add closed allow-list + BMAD Root resolver (AC: 1, 3, 4)
  - [x] **NEW** `apps/dashboard/src/lib/server/bmad-root.ts`
  - [x] Export a frozen allow-list in README order: `pocket-dimension`, `zeo`, `chhan-chhan` (do **not** derive the set by globbing `_bmad-output/*`)
  - [x] `resolveBmadRoot()`: walk up from `import.meta.dir` (and/or `process.cwd()`) until a directory containing `_bmad-output/` exists; `realpath` that root
  - [x] `listCurrentTrees()`: for each allow-listed slug, if `_bmad-output/<slug>/` exists as a directory after `realpath`, include it; skip missing; never include non-allow-listed siblings (e.g. a leftover `rhymes/` or `tmp/`)
  - [x] `resolveTreePath(slug)` (or equivalent): join + `realpath`; reject if result is outside `_bmad-output/<slug>` / allow-list (symlink escape / `..`)
  - [x] On missing/unreadable BMAD Root: return a clear failure shape (empty `trees` + error reason string) — do **not** invent trees or Sample World
  - [x] **NEW** `apps/dashboard/src/lib/server/bmad-root.test.ts` with `bun:test` (temp dirs): allow-list intersection, leftover exclusion, walk-up discovery, realpath reject, missing root

- [x] Wire request-time layout load + URL `tree` (AC: 1, 2, 3, 4)
  - [x] **NEW** `apps/dashboard/src/routes/+layout.server.ts` — `load` reads disk each navigation (no watcher, no boot cache)
  - [x] Parse `url.searchParams.get('tree')`; if missing/invalid/not in the live `trees` list → select **first** entry of `trees` (allow-list order ∩ disk)
  - [x] Return at least `{ trees, tree }` (and optional `bmadRootError` / empty reason). Do **not** implement full `snapshot` / `searchCorpus` / `tests` corpus walks here — leave stubs omitted or empty placeholders only if needed for typing; Epic 2–4 / Story 1.4 fill them
  - [x] Prefer a flat DTO (pocket style) — no `{ data, error }` envelope. Fail the whole page only when the root is unreadable; otherwise empty `trees` + chrome still renders
  - [x] Optional **NEW** `apps/dashboard/src/lib/types.ts` with `TreeId` union matching the three slugs

- [x] Tree switcher chrome (AC: 1, 2)
  - [x] **NEW** `apps/dashboard/src/lib/components/tree-switcher.svelte` (kebab-case; architecture product component)
  - [x] Place in sidebar brand area (below/near “dashboard” label) in both desktop rail and `< lg` sheet — UX-DR5 / EXPERIENCE.md
  - [x] List only `trees` from load; active tree = surface/card fill + accent **left hairline**, not a filled violet block (UX-DR4)
  - [x] Selecting a tree updates URL via SvelteKit `goto` with `?tree=<slug>` (preserve pathname; `keepFocus` / `noScroll` as appropriate). URL is source of truth — **not** `sessionStorage`
  - [x] Keyboard operable (click + keyboard); no hover-only selection (EXPERIENCE ban)
  - [x] When `trees` is empty / root error: show one display line + one body reason in the main column (or switcher area) — e.g. “BMAD Root unavailable.” + short reason. No illustrations, no Sample World

- [x] Update shell / layout / page to consume data (AC: 1–4)
  - [x] **UPDATE** `app-shell.svelte`: accept `trees`, `tree` (and optional error); render `tree-switcher`; keep section labels inert (Story 1.4 owns real section routes/active nav)
  - [x] **UPDATE** `+layout.svelte`: pass `data` from layout load into `AppShell`
  - [x] **UPDATE** `+page.svelte` lightly: show selected tree name in quiet copy so selection is visible before Overview lands in 1.4 — still not Overview counts/links
  - [x] Preserve Story 1.1–1.2 contracts: health, port 3011, no auth/DB, DESIGN.md tokens, Fira Code, rail/sheet

- [x] Package test script (AC: 1)
  - [x] Add `"test": "bun test src"` (or equivalent) to `apps/dashboard/package.json` if missing — match zeo / epics convention
  - [x] Run `bun test src` inside `apps/dashboard` for `bmad-root.test.ts`
  - [x] Run `bun run check` inside `apps/dashboard`

- [x] Verify manually (AC: 1–4)
  - [x] `bun run dev:app:dashboard` → switcher shows `pocket-dimension`, `zeo`, `chhan-chhan` (all present on this checkout)
  - [x] `?tree=zeo` → refresh keeps zeo; `?tree=not-a-tree` → falls back to first allow-listed existing tree
  - [x] Do **not** add leftover folders to the repo permanently; unit tests cover leftover exclusion
  - [x] Health still `{"status":"ok"}`

## Dev Notes

### Scope boundary (critical)

| In scope | Out of scope (later) |
| --- | --- |
| Closed allow-list + `bmad-root.ts` + realpath | Full `read-tree.ts` / classifier / markdown (Epic 2) |
| `listCurrentTrees` ∩ disk | Overview counts + real section routes (1.4) |
| `tree-switcher` + `?tree=` URL truth | Features / Delivery / Docs / Search / Tests catalog |
| Honest empty when root missing | File watcher, MiniSearch, Sample World, configurable BMAD Root UI |
| Co-located `bmad-root.test.ts` | Writing leftover trees into `_bmad-output/` for “demo” |

Do **not** invent leftover-tree inclusion. Do **not** implement Features/Docs/Search. Do **not** glob `_bmad-output/*` as the Catalog.

### Allow-list contract (copy exactly)

Canonical Current BMAD Trees (from `_bmad-output/README.md` / PRD glossary):

1. `pocket-dimension`
2. `zeo`
3. `chhan-chhan`

**Algorithm:** `trees = ALLOW_LIST.filter(slug => isDirectory(realpath(_bmad-output/slug)))`  
**Not:** `readdir(_bmad-output).filter(isDirectory)` then hope leftovers are gone.

“First allow-listed tree” = first slug in that constant order that exists on disk. Invalid `?tree=` never falls back to a leftover folder name.

Adding a new living tree later requires updating the README **and** this allow-list constant (PRD: “A new living tree is added to that README before the Catalog will show it”).

### Current UPDATE / NEW files (read before editing)

State after Story 1.2 (`baseline_commit` `fcc8d37`):

| File | Current state | This story changes | Must preserve |
| --- | --- | --- | --- |
| `apps/dashboard/src/lib/components/app-shell.svelte` | Rail 280px + sheet; brand “dashboard”; **static** section labels (Overview…); no tree data | Accept `trees`/`tree`/(error); mount `tree-switcher` in brand area (rail + sheet) | DESIGN tokens usage; sheet trigger keyboard; no accent sidebar fill; section labels stay non-routing until 1.4 |
| `apps/dashboard/src/routes/+layout.svelte` | Renders `AppShell` + children only; **no** `data` | Pass layout `data` into shell | `{@render children()}`; css import pattern |
| `apps/dashboard/src/routes/+layout.ts` | Font + css side effects only | Usually untouched (keep fonts); server load goes in `+layout.server.ts` | Fira Code 400/500 imports |
| `apps/dashboard/src/routes/+page.svelte` | Quiet placeholder “dashboard” | Show selected tree name / empty-root copy; not Overview FR-17 | No hub tiles; quiet type ramp |
| `apps/dashboard/src/routes/health/+server.ts` | `{ status: "ok" }` | **Do not change** | Health contract |
| `apps/dashboard/src/app.css` | DESIGN.md tokens | **Do not restyle** for this story | Hex brand layer |
| `apps/dashboard/package.json` | No `test` script | Add `bun test src` | Name, scripts, no auth/db |

**NEW (required):**

| File | Role |
| --- | --- |
| `src/lib/server/bmad-root.ts` | Allow-list, walk-up root, list trees, realpath guard |
| `src/lib/server/bmad-root.test.ts` | bun:test coverage |
| `src/routes/+layout.server.ts` | Request-time `{ trees, tree, … }` |
| `src/lib/components/tree-switcher.svelte` | Current BMAD Trees UI |

**Optional NEW:** `src/lib/types.ts` (`TreeId`, load DTO).

**Do not create yet:** `read-tree.ts`, `markdown.ts`, `classify.ts`, `search-overlay`, section routes, Sample World.

### Architecture compliance

- `$lib/server` = fs + realpath only; no `fs` in `$lib/catalog` or components
- Layout freshness: rebuild on each `load` / navigation — NFR-6
- Authorization = allow-list + realpath; reject escape (NFR-5)
- Dual-nav URL: `tree` query key; invalid → first allow-listed existing tree ([Source: architecture-dashboard.md — Frontend Architecture / Gap Analysis])
- Target layout payload shape (full product): `{ trees, tree, snapshot, searchCorpus, tests }` — **this story owns `trees` + `tree`**; leave others for later stories
- Named absences: Sample World, file watcher, leftover trees in Catalog, write APIs, auth
- Product components: kebab-case under `$lib/components/`

### Library / framework requirements

- Stack unchanged: Svelte 5 runes, SvelteKit 2, Bun, Tailwind 4, shadcn already present
- URL updates: `goto` from `$app/navigation` with a new `URL` / searchParams copy (SvelteKit 2 does not make `page.url.searchParams` writable)
- Tests: `import { describe, expect, it } from "bun:test"` — same as zeo
- Node/Bun fs: `realpathSync` / `fs.promises.realpath`; prefer Bun-native APIs already used in monorepo if present
- Do not add MiniSearch, remark, Drizzle, Better Auth

### Project Structure Notes

```
apps/dashboard/src/
  lib/
    types.ts                 # optional NEW — TreeId
    server/                  # NEW directory
      bmad-root.ts           # NEW
      bmad-root.test.ts      # NEW
    components/
      app-shell.svelte       # UPDATE
      tree-switcher.svelte   # NEW
  routes/
    +layout.server.ts        # NEW
    +layout.svelte           # UPDATE — pass data
    +layout.ts               # PRESERVE fonts
    +page.svelte             # UPDATE — selected tree / empty copy
    health/+server.ts        # PRESERVE
```

Conflict note: a naive `readdir('_bmad-output')` would contradict FR-1 / PRD honesty even if leftovers are currently absent — implement the closed set.

### Previous story intelligence (1.1 → 1.2)

- 1.1: pocket sibling scaffold on **3011**; hub stripped; shadcn (incl. sheet) installed; deploy files deleted — do not resurrect
- 1.2: DESIGN.md tokens + Fira Code; `app-shell` rail/sheet; section labels are **placeholders** — 1.3 adds tree switching beside them, not Overview nav wiring
- 1.2 explicitly deferred `bmad-root.ts` and `?tree=` to **this** story
- Run `bun run check` / `bun test` **inside** `apps/dashboard` (root filter check had ENOENT historically)
- Do not edit `apps/pocket/**` or rhymes `sprint-status.yaml` / `epics.md` / `architecture.md`
- Dashboard tracking file only: `sprint-status-dashboard.yaml`

### Git intelligence

Recent commits on this branch:

- `fcc8d37` — story 1.2 quiet dark chrome (`app-shell`, tokens, Fira Code)
- `b5f43bb` — story 1.1 dashboard scaffold
- `630dce2` — dashboard PRD/UX/architecture/epics

Implement atop `fcc8d37` tree; do not re-scaffold or re-token.

### Latest tech information

- SvelteKit 2: update query with `goto(newUrl, { keepFocus: true, noScroll: true })` — do not mutate `page.url.searchParams` in place expecting reactivity
- `@sveltejs/kit` in app is `^2.49.1`; stay on monorepo sibling ranges
- Bun `realpath` / `import.meta.dir` are correct for server modules under Vite SSR — walk-up must not assume Vite cwd is always repo root (architecture gap closure #2)

### Testing requirements

Automated:

```bash
cd apps/dashboard
bun test src
# Cover at least:
# - allow-list ∩ existing dirs
# - leftover first-level dir ignored
# - walk-up finds _bmad-output from a nested start path
# - path outside allow-list rejected after realpath
# - missing _bmad-output → empty/error, not fake trees
```

Manual:

```bash
bun run dev:app:dashboard
# Browser: switcher lists three trees; change selection → URL ?tree=; refresh restores
# ?tree=garbage → first allow-listed existing tree
curl -sS http://localhost:3011/health   # {"status":"ok"}
cd apps/dashboard && bun run check
```

Fail if: leftover folder would appear (logic uses readdir-all); Sample World; sessionStorage as tree truth; watcher added; Features/Docs/Search implemented; health/port/auth regressions.

### Anti-patterns (do not)

- `readdir(_bmad-output)` as the Catalog source
- Hard-coding only `pocket-dimension` without checking disk existence
- Showing README names that are **missing** on disk as selectable trees
- Falling back invalid `?tree=` to a leftover directory name
- Sample World / fixture corpus when root missing
- `sessionStorage` / localStorage as Tree source of truth
- File watcher / chokidar
- Implementing Overview counts, Docs Reader, Search ⌘K, Delivery, or `read-tree` full snapshot
- Editing rhymes `sprint-status.yaml`, non-dashboard `epics.md` / `architecture.md`
- Accent-filled switcher buttons; hover-only controls
- Logging full file contents on path reject (warn with relative path only)

### Empty / error copy (EXPERIENCE voice)

When BMAD Root is missing/unreadable or `trees` is empty:

- One display line + one body reason
- Prefer: **“BMAD Root unavailable.”** + concrete reason (e.g. “`_bmad-output` was not found from the app working directory.”)
- Do **not**: “Oops!”, Sample World offers, inventing trees

### References

- [Source: planning-artifacts/epics-dashboard.md — Story 1.3, Epic 1, FR-1, UX-DR5, Additional Requirements allow-list]
- [Source: planning-artifacts/architecture-dashboard.md — bmad-root.ts, closed allow-list, layout payload, Frontend URL `tree`, Gap Analysis walk-up, Project Structure]
- [Source: planning-artifacts/ux-designs/ux-dashboard-2026-08-23/EXPERIENCE.md — Tree switcher; Voice; empty/error; interaction bans]
- [Source: planning-artifacts/ux-designs/ux-dashboard-2026-08-23/DESIGN.md — empty/error typography; rail]
- [Source: planning-artifacts/prds/prd-dashboard-2026-08-23/prd.md — FR-1, glossary Current BMAD Tree, honesty]
- [Source: planning-artifacts/prds/prd-dashboard-2026-08-23/addendum.md — allow-list; rhymes already gone]
- [Source: _bmad-output/README.md — Layout: pocket-dimension, zeo, chhan-chhan]
- [Source: implementation-artifacts/1-2-show-quiet-dark-chrome-that-does-not-compete-with-content.md — deferred bmad-root / ?tree=; app-shell baseline]
- [Source: apps/dashboard/src/lib/components/app-shell.svelte — UPDATE baseline]

## Dev Agent Record

### Agent Model Used

Composer (Cursor Cloud Agent)

### Debug Log References

- Fixed Vite SSR `import.meta.dir` undefined by falling back to `import.meta.url` + `process.cwd()` in `defaultStartDirs()`.

### Completion Notes List

- Implemented closed allow-list BMAD root resolver with walk-up discovery, realpath guards, and symlink-escape rejection.
- Wired request-time `+layout.server.ts` load returning `{ trees, tree, bmadRootError }`; invalid/missing `?tree=` falls back to first allow-listed existing tree.
- Added `tree-switcher.svelte` in rail + mobile sheet with URL-driven selection via `goto`.
- Updated `app-shell`, `+layout.svelte`, and `+page.svelte` to consume tree data and show honest empty/error copy.
- Added `bun test src` script; 8 unit tests pass; `bun run check` clean.
- Manual verification via dev server + curl: three trees listed, `?tree=zeo` selects zeo, invalid param falls back to `pocket-dimension`, health OK.

### File List

- apps/dashboard/package.json
- apps/dashboard/src/lib/types.ts
- apps/dashboard/src/lib/server/bmad-root.ts
- apps/dashboard/src/lib/server/bmad-root.test.ts
- apps/dashboard/src/lib/components/tree-switcher.svelte
- apps/dashboard/src/lib/components/app-shell.svelte
- apps/dashboard/src/routes/+layout.server.ts
- apps/dashboard/src/routes/+layout.svelte
- apps/dashboard/src/routes/+page.svelte
- _bmad-output/pocket-dimension/implementation-artifacts/1-3-switch-among-current-bmad-trees-only.md
- _bmad-output/pocket-dimension/implementation-artifacts/sprint-status-dashboard.yaml

## Change Log

- 2026-08-23: Story 1.3 context created (ready-for-dev) — Current BMAD Trees allow-list, bmad-root, tree switcher, `?tree=` URL truth.
- 2026-08-23: Story 1.3 implemented — closed allow-list tree discovery, switcher UI, URL `?tree=` selection, tests passing.
