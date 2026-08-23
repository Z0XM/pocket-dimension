---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - planning-artifacts/prds/prd-dashboard-2026-08-23/prd.md
  - planning-artifacts/prds/prd-dashboard-2026-08-23/addendum.md
  - planning-artifacts/ux-designs/ux-dashboard-2026-08-23/DESIGN.md
  - planning-artifacts/ux-designs/ux-dashboard-2026-08-23/EXPERIENCE.md
  - project-context.md
workflowType: architecture
lastStep: 8
status: complete
completedAt: 2026-08-23
project_name: dashboard
user_name: Ubuntu
date: 2026-08-23
note: Separate from planning-artifacts/architecture.md (rhymes revamp). Do not overwrite that file.
discoveredCandidates:
  - planning-artifacts/prds/prd-dashboard-2026-08-23/prd.md
  - planning-artifacts/prds/prd-dashboard-2026-08-23/addendum.md
  - planning-artifacts/ux-designs/ux-dashboard-2026-08-23/DESIGN.md
  - planning-artifacts/ux-designs/ux-dashboard-2026-08-23/EXPERIENCE.md
  - project-context.md
  - index.md
  - development-guide.md
---

# Architecture Decision Document — dashboard

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
17 FRs, no dashboard epics yet. Design against FR-level intent, not an epic map. Do not freeze module boundaries that assume stories we have not written.

Architecturally this is one read-only Showcase: **one filesystem becoming five consistent views** (Overview, Features, Delivery, Tests, Docs/Reader), plus Search. It is a view of what exists, not a system of record and not a place work lives.

- **Discovery** (FR-1–FR-3, FR-17): closed Current BMAD Tree set for v1 (`pocket-dimension`, `zeo`, `chhan-chhan` per `_bmad-output/README.md` — not a glob of `_bmad-output/*`). Overview is the app-open landing (counts/links). Docs Catalog by Artifact Kind.
- **Read** (FR-4–FR-6, FR-10): shared read pipeline, multiple facades. Markdown Reader, run-folder primary file, in-root links, empty/error/missing states. dashboard’s own BMAD files appear like any other Artifact. Never serve paths outside allow-listed roots (path traversal / symlink).
- **Structured surfaces** (FR-7–FR-9, FR-13–FR-15): Features extracted from planning Artifacts (not a second Feature database). Epics/Stories from files. Delivery **board, table, and timeline are three views of one derived dataset**. Status is a derived projection with an explicit precedence rule (algorithm later); unknown shapes skip, never invent. Interactive chrome is display-only — no write-back, including “just for local.”
- **Find** (FR-12, FR-16): Search is case-insensitive substring/token with snippets; corpus and hit bounds later. Tests catalog is a **second corpus** (`apps/**`, e.g. zeo and chhan-chhan importers) — FR-16 never scans `_bmad-output` for tests. Test runner is a hard v1 non-goal.
- **Chrome** (FR-11): dark / violet / Fira Code / shadcn; desktop-first. Keyboard is a second navigation system (⌘K and `/`): global shortcut ownership, single overlay, restore-focus on close. Dual-nav (section + Tree) needs URL truth and refresh memory. Contrast/focus on black is load-bearing, not “skip because no audit.”

Keep **artifact class** (what the file is) separate from **surface** (where we show it).

**Non-Functional Requirements:**
Honesty is load-bearing: live disk only, never Sample World, never invent Artifacts or leftover trees. §6.3 (Blockers, Questions, Deferred, test runner, API, Pocket tile) are **named absences**, not nearby hooks. Reload on navigation; no file watcher. Freshness is a contract (mechanism later: request-time vs boot index) so Features / Docs / Search do not diverge. Opening a typical Story must feel immediate. Keyboard-complete UJ-1–UJ-7. Markdown is untrusted content in a privileged renderer (no script execution). WCAG AA is a target, not a formal gate — tokens must still hold contrast. Runtime data: v1 shows whatever is on disk in this checkout; empty Tree is an empty state, not a fake corpus.

**Scale & Complexity:**
- Primary domain: local web Showcase (read / parse / render)
- Complexity level: **low ops, high consistency risk** (classification + derived status). Small surface because scope is locked — not a license to skip rigor.
- Estimated architectural components: ~8 (app shell + dual-nav, tree allow-list, artifact classifier, shared markdown read/sanitize, feature extractor, delivery/timeline projection, search index, test catalog)

SIS `packages/dev-dashboard` (branch `dev`) is **IA inspiration only** — not their data model, index, or package layout.

### Technical Constraints & Dependencies

- BMAD files under `_bmad-output/` are the record. No second product database. No auth-service.
- Three trees, three conventions — classifier cannot assume one naming scheme. Path/filename rules first; heuristics second; unknown → unclassified.
- Dual root: BMAD markdown + `apps/**` tests.
- No watcher, no DB, no test runner, search = substring/token only.
- Configurable BMAD Root is welcome later; v1 closed Tree set. Multi-tenant hosting is not.
- Monorepo deploy-from-root if it ever deploys. Port / SvelteKit vs other scaffold is a later decision.

### Cross-Cutting Concerns Identified

- Closed allow-list vs raw directory listing
- Artifact Kind vs surface naming
- One Delivery projection, three presentations
- Status precedence (TBD) — never write back
- Search/index freshness vs navigation reload
- Shared read/sanitize pipeline (Overview, Docs, Reader, Search)
- Dual corpus (BMAD vs tests)
- Keyboard registry, one overlay, focus restore
- Dual-nav URL + refresh memory
- Empty / missing / unreadable Artifact honesty

## Starter Template Evaluation

### Primary Technology Domain

Local web Showcase in the Pocket Dimension Bun + Turbo monorepo.

### Starter Options Considered

- **sv create (Svelte CLI 0.17.0)** — current upstream SvelteKit template (`bunx sv create --template minimal --types ts`). Greenfield; would need adapter-bun, Turbo filters, workspace naming, Tailwind 4 Vite plugin, shadcn-svelte re-done by hand.
- **SIS packages/dev-dashboard** — React/Vite War Room. Rejected: behavioral inspiration only.
- **In-repo sibling (`apps/pocket` + shadcn from `apps/watchlist`)** — matches existing standalone apps. Pocket has no auth/DB. Watchlist already has `components.json` + bits-ui + shadcn-svelte.

### Selected Starter: In-repo sibling (pocket shell + watchlist shadcn)

**Rationale for Selection:**
Same runtime as every other SvelteKit app here. No second component language. No SIS React import. First story is copy-and-strip, not invent-a-scaffold.

**Initialization Command:**

```bash
# First implementation story — not run during architecture.
# 1. Copy apps/pocket → apps/dashboard; rename package @pocket-dimension/dashboard
# 2. Strip pocket hub catalog; keep SvelteKit + adapter-bun + Vite/Bun scripts
# 3. Copy shadcn wiring from apps/watchlist (components.json, $lib/utils, ui primitives as needed)
# 4. Add root package.json turbo filters: build:app:dashboard, dev:app:dashboard
# 5. Default port 3011
# 6. Add components as needed:
bunx shadcn-svelte@latest add button dialog command input scroll-area separator badge table tabs
```

Fallback if sibling copy is blocked:

```bash
bunx sv create apps/dashboard --template minimal --types ts --no-add-ons --no-install
```

Then immediately align with pocket/watchlist (adapter-bun, Tailwind 4 Vite, shadcn-svelte). Prefer the sibling copy.

**Architectural Decisions Provided by Starter:**

**Language & Runtime:** TypeScript, Svelte 5, SvelteKit 2, Bun (`bun --bun vite`), `svelte-adapter-bun`

**Styling Solution:** Tailwind 4 (`@tailwindcss/vite`), shadcn-svelte 1.5.x / bits-ui, DESIGN.md tokens (Fira Code, black/violet)

**Build Tooling:** Vite 7 as used by sibling apps; Turbo workspace filter; Prettier via repo root

**Testing Framework:** Vitest at repo/app level (zeo pattern). Parser golden fixtures live with the dashboard app, not in BMAD files.

**Code Organization:** `apps/dashboard/src/routes` for surfaces; `$lib` for parse/search/read pipeline; `$lib/components/ui` for shadcn

**Development Experience:** `bun run dev:app:dashboard`; no auth-service; no PostgreSQL

**Note:** Project initialization using this sibling copy is the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

- Filesystem-only data. No PostgreSQL, no Drizzle, no product DB. Derived in-memory models rebuilt on each SvelteKit server `load`.
- Closed allow-list roots: `_bmad-output/{pocket-dimension,zeo,chhan-chhan}/` plus test globs under `apps/**`. Realpath resolve; reject escape (path traversal / symlink).
- Markdown: parse then sanitize on the server. Never unsanitized `{@html}`. Pipeline: `remark-gfm@^4` → rehype → `rehype-sanitize@^6` (verified ~2026-08-23: remark-gfm 4.0.1, rehype-sanitize 6.0.0). Fallback: marked + isomorphic-dompurify if unified proves awkward with Bun — same contract, different implementation.
- One Delivery dataset; board / table / timeline are views of that dataset. Default view: board.
- Dual-nav truth lives in the URL: selected Tree + section (+ Delivery `view`). Refresh restores both.
- Tests catalog scans `apps/**` for `*.test.ts` / `*.spec.ts` (and equivalent). Never scans `_bmad-output`.
- Display-only. No write endpoints. No write-back to disk, including “just for local.”

**Important Decisions (Shape Architecture):**

- Search: case-insensitive substring/token over the load payload. No MiniSearch in v1.
- Status precedence: `sprint-status.yaml` then Story `Status:` line; else unknown. Never invent.
- No public REST API and no API-docs nav. `$lib/server` readers only.
- Port **3011**. `bun run dev:app:dashboard`.
- Svelte 5 runes for UI state. No extra store library (no Zustand/Redux/writable-for-everything).
- Deploy-from-root Dockerfile/Railpack only if/when the app is deployed — v1 success does not require deploy.

**Deferred Decisions (Post-MVP):**

- File watcher (PRD: reload on navigation only).
- MiniSearch / dedicated search engine.
- Test runner, Blockers, Questions, Deferred, API docs, Pocket hub tile (PRD §6.3).
- Auth, DB, configurable BMAD Root UI, multi-tenant hosting.
- Boot-time index as source of truth (rejected for v1 freshness).

### Data Architecture

No database. Source of truth is the git checkout on disk.

- **BMAD corpus:** `_bmad-output/{pocket-dimension,zeo,chhan-chhan}/` — closed set from `_bmad-output/README.md`, not a glob of leftover trees.
- **Test corpus:** `apps/**/*.{test,spec}.ts` (and equivalent under `apps/`). Separate reader; never mixed into Artifact Kind classification.
- **Freshness:** request-time via `+layout.server.ts` / `+page.server.ts`. Navigation reloads. No watcher. No boot cache as the source of truth. Optional per-request memoization inside a single load is allowed; it must not survive across navigations as a product cache.
- **Validation:** parsers return classified records or unclassified. Unknown shapes are skipped, never invented. Status dates and Feature ids only when present in files.
- **Delivery projection:** one derived dataset consumed by board, table, and timeline. Status algorithm: (1) `sprint-status.yaml` if present and parseable, (2) Story file `Status:` line, (3) unknown. Columns/order come from that projection, not from three independent parsers.
- **Caching:** none beyond a single request.

### Authentication & Security

- No Better Auth, no sessions, no cookies for identity.
- Authorization = filesystem allow-list. Resolve `realpath`; reject any path outside BMAD Root trees or the test glob roots.
- Markdown is untrusted content in a privileged renderer: unified `remark-gfm` → rehype → `rehype-sanitize` **on the server** before `{@html}`. Scripts, event handlers, and `javascript:` URLs stripped.
- Display-only UI: no POST/PATCH/DELETE for product data. Health check may exist (pocket pattern) and must not expose file contents outside the allow-list.
- CSP: follow sibling SvelteKit defaults; do not weaken to allow inline script from markdown.

### API & Communication Patterns

- No public HTTP API. No OpenAPI. No API nav.
- SvelteKit server loads pass DTOs to pages. Shared readers live in `$lib/server` (pocket already uses this for env).
- Errors:
  - Missing / unreadable Artifact → Reader error state (“Unreadable Artifact.” + reason).
  - Empty classified set → empty state (“No Features in this Tree.” etc.).
  - Parse skip → unclassified or omit; never a fake row.
- Search is not a separate service: overlay queries the snapshot from the current load.

### Frontend Architecture

- **Routes:** `/` Overview, `/features`, `/delivery` (board | table | timeline), `/tests`, `/docs`, `/epics/[id]`, `/stories/[id]`. `/timeline` redirects to `/delivery?view=timeline`.
- **URL owns:** `tree` (one of `pocket-dimension` | `zeo` | `chhan-chhan`) and Delivery `view` (`board` default). Invalid tree → first allow-listed tree, not a leftover folder.
- **State:** Svelte 5 runes. Layout load shares the per-navigation snapshot. Search overlay is local UI state (one Dialog). No sessionStorage as Tree source of truth (URL is).
- **Keyboard:** global shortcut ownership in one registry. `⌘K` / `Ctrl+K` and `/` open Search. Esc closes. Restore focus on close. One overlay; no modal stack.
- **Chrome:** DESIGN.md tokens (`#0A0A0A` / `#111111` / `#8B5CF6` / Fira Code). shadcn brand-layer only. Sidebar Tree switcher + section nav. `< lg` sidebar becomes a sheet.

### Infrastructure & Deployment

- Dev: `bun run dev:app:dashboard`, port **3011**. No auth-service. No PostgreSQL.
- Optional later: Dockerfile + `railpack.json` + `scripts/deploy-build.sh` from repo root, same as pocket. v1 architecture does not require these files to exist.
- Empty or missing `_bmad-output` trees: empty Overview, not Sample World.
- Logging: server parse/skip at warn; do not log full file contents.

### Decision Impact Analysis

**Implementation Sequence:**

1. Sibling scaffold (`apps/pocket` → `apps/dashboard` + watchlist shadcn + Turbo filters + port 3011).
2. Allow-list path resolver (BMAD trees + test globs).
3. Shared markdown read + sanitize pipeline.
4. Artifact classifier (path/filename first; heuristics second; unknown → unclassified).
5. Delivery projection (status precedence) + board/table/timeline views.
6. Features extractor, Docs catalog + Reader, Tests catalog, Search overlay.
7. Dual-nav URL + keyboard registry + chrome tokens.

**Cross-Component Dependencies:**

- One read/sanitize pipeline feeds Overview, Docs, Reader, and Search. Do not parse markdown a second way on the client.
- One Delivery model feeds board, table, and timeline. Do not re-derive status per view.
- Test catalog is a second reader; Tree filter is a join when a path/app link exists, not a BMAD-file scan.
- URL Tree selection is an input to every surface load; Search still uses the same snapshot.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
12 areas where agents could fork: file naming, `$lib` layout, URL query keys, Tree ids, Artifact Kind vs surface, DTO field case, load return shape, status union, date strings, empty/missing/unreadable, search overlay ownership, parser vs UI split.

### Naming Patterns

**Database Naming Conventions:**
None. No tables. Do not invent a schema “for later.”

**API Naming Conventions:**
No public REST. SvelteKit routes only.

- Paths: `/`, `/features`, `/delivery`, `/tests`, `/docs`, `/epics/[id]`, `/stories/[id]`
- Alias: `/timeline` → `/delivery?view=timeline`
- Query keys: `tree`, `view` (lowercase, no camelCase in the URL)
- Tree values: `pocket-dimension` | `zeo` | `chhan-chhan` (folder names)
- Delivery `view`: `board` | `table` | `timeline` (default `board`)
- `[id]` is a stable slug from the Artifact path/filename, not a UUID we invent

**Code Naming Conventions:**

- Svelte files: kebab-case (`tree-switcher.svelte`, `delivery-board.svelte`) — pocket `app-card.svelte`, watchlist `stat-card.svelte`
- shadcn: `$lib/components/ui/<name>/` as generated; do not rename
- Product components: `$lib/components/*.svelte` or `$lib/components/<area>/`
- Types: PascalCase (`TreeId`, `ArtifactKind`, `DeliveryItem`)
- Functions/vars: camelCase (`loadTreeSnapshot`, `sanitizeMarkdown`)
- Server-only modules: `$lib/server/*.ts` (never imported from client components)
- Kind in code: `'epic' | 'story' | 'feature' | 'doc' | 'prd' | 'ux' | 'architecture' | 'unclassified'`
- Kind on screen: Epic, Story, Feature, Test, Docs (EXPERIENCE.md)
- Status in code: `'backlog' | 'in-progress' | 'done' | 'unknown'` (map file strings; do not invent extra columns in v1)

### Structure Patterns

**Project Organization:**

```
apps/dashboard/
  src/routes/          # surfaces only
  src/lib/server/      # fs allow-list, readers, markdown pipeline
  src/lib/catalog/     # classifier, feature extract, delivery projection, search tokens (pure)
  src/lib/components/  # chrome + surfaces; ui/ = shadcn
  src/**/*.test.ts     # co-located; parser fixtures next to parsers
```

- Parsers are pure: path + text in, DTO out. No `fs` in `$lib/catalog`.
- `fs` / `realpath` only in `$lib/server`.
- Tests catalog reader lives in `$lib/server/tests.ts` (or similar), not in catalog BMAD parsers.
- Do not put dashboard runtime code under `_bmad-output/`.
- App tests do not live in BMAD trees.

**File Structure Patterns:**

- `components.json` copied from watchlist (aliases `$lib/components`, `$lib/utils`)
- Tokens in `src/app.css` from DESIGN.md; no second token file
- Env: none required for v1 (optional later `BMAD_ROOT` is deferred)

### Format Patterns

**API Response Formats:**
SvelteKit `load` returns the DTO directly (pocket: `{ apps }`). No `{ data, error }` envelope.

- Success: `{ tree, trees, snapshot }` (names may refine; shape is flat)
- Fail a single Artifact: include it as `{ id, kind, error: string }` in the list; do not fail the whole page
- Fail the whole page only if the allow-list root is unreadable

**Data Exchange Formats:**

- JSON/DTO fields: camelCase (`sourcePath`, `artifactKind`, `status`)
- Dates: ISO 8601 strings or `null` — never invented
- Booleans: `true`/`false`
- Null: missing optional field is `null` or omitted consistently per type; do not use `""` for missing dates
- Search hit: `{ kind, id, title, snippet, href }`

### Communication Patterns

**Event System Patterns:**
No app-wide event bus. Search open/close is local rune state in the shell. Keyboard registry is one module that binds window listeners.

**State Management Patterns:**

- Per-navigation snapshot from layout/page `load` is the data source
- URL is the source of truth for `tree` and `view`
- UI-only: Search query, overlay open, sidebar sheet, highlighted index — runes, not a store lib
- Do not cache snapshots in `localStorage`

### Process Patterns

**Error Handling Patterns:**

| Condition | User copy | Agent must |
|---|---|---|
| Empty classified set | “No Features in this Tree.” (etc.) | empty state, not Sample World |
| Missing / unreadable file | “Unreadable Artifact.” + reason | Reader error, keep chrome |
| Unknown file shape | omit or unclassified | never invent status/dates |
| Search miss | “No matches for {query}.” | EXPERIENCE.md voice |
| Path outside allow-list | do not serve | throw / 404, log warn |

Server parse skips: `console.warn` with relative path; do not dump file bodies.

**Loading State Patterns:**

- Cold load: short “Reading BMAD…” or skeletons (EXPERIENCE.md)
- No global spinner that blocks chrome
- Search overlay: local pending only if a load is in flight; v1 search is in-memory on the snapshot

### Enforcement Guidelines

**All AI Agents MUST:**

- Read-only: no write to BMAD files or `apps/**` from this app
- Sanitize markdown on the server before `{@html}`
- Use one Delivery projection for all three views
- Scan tests under `apps/**` only
- Keep Tree + view in the URL
- Follow kebab-case Svelte files and `$lib/server` vs `$lib/catalog` split
- Use EXPERIENCE.md copy for empty/error/search-miss

**Pattern Enforcement:**

- Architecture + this section are the contract; PRD/UX win on product copy and IA
- Parser golden tests lock classifier/status/sanitize
- Pattern changes go in this file, not in ad-hoc comments

### Pattern Examples

**Good Examples:**

- `src/lib/server/bmad-root.ts` — allow-list + realpath
- `src/lib/catalog/classify.ts` — `(relativePath: string) => ArtifactKind | 'unclassified'`
- `src/routes/delivery/+page.svelte` — receives `items`; board/table/timeline only switch presentation
- `/delivery?tree=zeo&view=timeline`

**Anti-Patterns:**

- `{@html}` of raw markdown
- MiniSearch or a watcher in v1
- Nav items for Blockers / Questions / Deferred / API
- Sample World fixtures as fallback data
- `sessionStorage` as Tree source of truth
- Three independent status parsers for board vs table vs timeline
- Scanning `_bmad-output` for tests
- PascalCase `DeliveryBoard.svelte` (forks from pocket/watchlist)

## Project Structure & Boundaries

### Complete Project Directory Structure

Monorepo **touches** (not a new repo):

```
pocket-dimension/
├── package.json                    # add build:app:dashboard, dev:app:dashboard
├── AGENTS.md                       # port 3011 row
├── README.md                       # optional one-line if other apps are listed
└── apps/dashboard/                 # new app
```

Do **not** add `shared/dashboard`. Parsers stay in the app. Do **not** put runtime code in `_bmad-output/`. Dockerfile / Railpack **deferred** (same as “optional later” in decisions).

```
apps/dashboard/
├── package.json                    # @pocket-dimension/dashboard
├── components.json                 # from watchlist
├── svelte.config.js                # adapter-bun, $lib alias (pocket)
├── vite.config.ts                  # Tailwind 4 plugin; PORT from env
├── tsconfig.json
├── .env.example                    # PORT=3011 HOST=0.0.0.0 (no auth, no DATABASE_URL)
├── .gitignore
├── src/
│   ├── app.html
│   ├── app.css                     # DESIGN.md tokens; Fira Code
│   ├── app.d.ts
│   ├── hooks.server.ts             # optional: deny path probes; no auth
│   ├── lib/
│   │   ├── utils.ts                # cn() from watchlist
│   │   ├── types.ts                # TreeId, ArtifactKind, DTOs
│   │   ├── keyboard.ts             # ⌘K / / / Esc registry (client)
│   │   ├── nav.ts                  # section list; no §6.3 items
│   │   ├── catalog/                # PURE — no fs
│   │   │   ├── classify.ts         # path → ArtifactKind | unclassified
│   │   │   ├── classify.test.ts
│   │   │   ├── features.ts         # FR-13 extract
│   │   │   ├── features.test.ts
│   │   │   ├── delivery.ts         # one projection; status precedence
│   │   │   ├── delivery.test.ts
│   │   │   ├── search.ts           # substring/token + snippets
│   │   │   ├── search.test.ts
│   │   │   ├── slug.ts             # Artifact id from path
│   │   │   └── fixtures/           # golden markdown snippets (not Sample World UI)
│   │   ├── server/                 # fs + realpath only
│   │   │   ├── bmad-root.ts        # allow-list trees; reject escape
│   │   │   ├── bmad-root.test.ts
│   │   │   ├── read-tree.ts        # walk + load snapshot
│   │   │   ├── markdown.ts         # remark-gfm → rehype-sanitize
│   │   │   ├── markdown.test.ts
│   │   │   └── tests-catalog.ts    # apps/**/*.test.ts|*.spec.ts
│   │   └── components/
│   │       ├── ui/                 # shadcn: button, dialog, command, input,
│   │       │                       # scroll-area, separator, badge, table, tabs, sheet
│   │       ├── app-shell.svelte
│   │       ├── tree-switcher.svelte
│   │       ├── section-nav.svelte
│   │       ├── search-overlay.svelte
│   │       ├── markdown-reader.svelte
│   │       ├── feature-row.svelte
│   │       ├── delivery-board.svelte
│   │       ├── delivery-table.svelte
│   │       ├── delivery-timeline.svelte
│   │       └── test-row.svelte
│   └── routes/
│       ├── +layout.server.ts       # tree + snapshot for the navigation
│       ├── +layout.svelte          # shell, dual-nav, search, keyboard
│       ├── +page.svelte            # Overview (FR-17)
│       ├── features/+page.svelte
│       ├── delivery/+page.server.ts
│       ├── delivery/+page.svelte   # board | table | timeline via ?view=
│       ├── timeline/+page.server.ts  # redirect → /delivery?view=timeline
│       ├── tests/+page.svelte
│       ├── docs/+page.svelte
│       ├── docs/[...path]/+page.server.ts
│       ├── docs/[...path]/+page.svelte
│       ├── epics/[id]/+page.server.ts
│       ├── epics/[id]/+page.svelte
│       ├── stories/[id]/+page.server.ts
│       ├── stories/[id]/+page.svelte
│       └── health/+server.ts       # pocket sibling; no file dump
└── static/                         # favicon only if pocket has one
```

No `src/routes/api/` product routes. No `src/lib/db`. No Blockers/Questions/Deferred/API routes.

### Architectural Boundaries

**API Boundaries:**
No public REST. Only SvelteKit `load` and `health`. Markdown HTML crosses the server→page boundary already sanitized.

**Component Boundaries:**
- Shell (`app-shell`, nav, search) owns chrome and URL `tree` / overlay.
- Surfaces own presentation of DTOs they receive. They do not call `fs`.
- `markdown-reader` only accepts sanitized HTML + meta.
- Delivery views share `DeliveryItem[]`; they do not re-parse stories.

**Service Boundaries:**
- `$lib/server` = disk + sanitize.
- `$lib/catalog` = classify / project / search tokens.
- `$lib/components` = UI.
- `$lib/keyboard.ts` = shortcut ownership (one overlay).

**Data Boundaries:**
- BMAD files: `_bmad-output/{pocket-dimension,zeo,chhan-chhan}/` via `bmad-root.ts`.
- Tests: `apps/**` via `tests-catalog.ts`.
- Snapshot is per-request; not a cache, not a DB.
- dashboard’s own BMAD files are just more Artifacts in the `pocket-dimension` tree.

### Requirements to Structure Mapping

**Feature/Epic Mapping:** (no dashboard epics yet — FR groups)

| FR | Lives in |
|---|---|
| FR-1–FR-3, FR-17 Discovery / Overview / Docs catalog | `+layout.server.ts`, `+page.svelte`, `docs/`, `classify.ts`, `tree-switcher.svelte` |
| FR-4–FR-6, FR-10 Reader / links / missing | `markdown.ts`, `markdown-reader.svelte`, `docs/[...path]/`, `epics/`, `stories/` |
| FR-7–FR-9, FR-14–FR-15 Delivery + timeline | `delivery.ts`, `routes/delivery/`, `delivery-*.svelte` |
| FR-13 Features | `features.ts`, `routes/features/`, `feature-row.svelte` |
| FR-12 Search | `search.ts`, `search-overlay.svelte`, `keyboard.ts` |
| FR-16 Tests catalog | `tests-catalog.ts`, `routes/tests/`, `test-row.svelte` |
| FR-11 Chrome / a11y / tokens | `app.css`, `app-shell.svelte`, `section-nav.svelte` |

**Cross-Cutting Concerns:**
- Allow-list / traversal: `bmad-root.ts`
- Freshness: layout `load` only
- Honesty / empty states: each `+page.svelte` using EXPERIENCE.md copy
- Dual-nav URL: `+layout.svelte` + query `tree` / `view`

### Integration Points

**Internal Communication:**
Layout load → snapshot → pages + Search. URL `tree` is an input to that load. No event bus.

**External Integrations:**
None in v1. No auth-service, no Resend, no Postgres, no Pocket hub tile.

**Data Flow:**
disk (allow-list) → read-tree → classify → (features \| delivery \| docs) + markdown sanitize → load DTO → surface. Parallel: apps/** → tests-catalog → Tests page (filter by Tree when a link exists).

### File Organization Patterns

**Configuration Files:**
App: `package.json`, `components.json`, `svelte.config.js`, `vite.config.ts`, `.env.example`. Root: Turbo scripts only. No `shared/db/.env`.

**Source Organization:**
Routes = surfaces. `catalog` = pure. `server` = fs. `components/ui` = shadcn. Product Svelte = kebab-case.

**Test Organization:**
Co-located `*.test.ts` next to catalog/server modules. Fixtures in `src/lib/catalog/fixtures/`. `bun test src` like zeo. No e2e required for v1 architecture.

**Asset Organization:**
`src/app.css` tokens. `@fontsource/fira-code` (not pocket’s Nunito). `static/` minimal.

### Development Workflow Integration

**Development Server Structure:**
`bun run dev:app:dashboard` → Vite on **3011**. No auth-service. No PostgreSQL. Shared packages: none required (`@pocket-dimension/utils` only if the pocket copy already depends on it and we keep it).

**Build Process Structure:**
`bun run build:app:dashboard` → adapter-bun `build/`. Same Turbo `build` outputs as siblings.

**Deployment Structure:**
Not required for v1. If added later: copy pocket’s `Dockerfile` / `railpack.json` / `scripts/deploy-build.sh` and deploy from repo root. Health at `/health`.

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
TypeScript / Svelte 5 / SvelteKit 2 / Bun / adapter-bun / Tailwind 4 / shadcn-svelte 1.5.x / bits-ui work as in pocket and watchlist. Markdown: `remark-gfm@^4` (4.0.1) + `rehype-sanitize@^6` (6.0.0). No DB, no auth, no SIS React. No version clash.

**Pattern Consistency:**
Kebab-case Svelte, `$lib/server` vs `$lib/catalog`, URL `tree`/`view`, direct `load` DTOs, one Delivery projection — all match the tree. Closures below fix the two pattern/PRD clashes (search scope, unclassified visibility).

**Structure Alignment:**
Routes match IA. Boundaries (fs only in server, pure catalog, chrome in components) support the patterns. Closures add `resolve-link.ts` and a split layout payload; they do not add a new package or API.

### Requirements Coverage Validation ✅

**Epic/Feature Coverage:**
No dashboard epics yet. Architecture is FR-mapped. UJ-1–UJ-7 each have a surface.

**Functional Requirements Coverage:**

| FR | Support |
|---|---|
| FR-1 Trees | allow-list + tree switcher; leftovers excluded |
| FR-2 Kind browse | classify + Docs catalog; one primary Kind |
| FR-3 Open Artifact | Docs / epics / stories routes + Reader |
| FR-4 Present content | remark→sanitize; run-folder: `prd.md` primary else list siblings |
| FR-5 In-root links | `resolve-link.ts` (closure) |
| FR-6 Empty/missing | EXPERIENCE.md states; per-Artifact error, page stays up |
| FR-7–FR-8 Epic/Story | Delivery + Reader; epic→story via existing links/filenames |
| FR-9 / FR-13 Features | extract from planning Artifacts; no second DB |
| FR-10 Dogfood | pocket-dimension tree; no special case |
| FR-11 Chrome | DESIGN.md tokens, Fira Code, shadcn, desktop-first |
| FR-12 Search | searchCorpus all trees + optional Tree narrow (closure) |
| FR-14–FR-15 Delivery/Timeline | one projection; three views; `/timeline` alias |
| FR-16 Tests | `apps/**` catalog; no runner; no `_bmad-output` scan |
| FR-17 Overview | `/` landing, counts + links |

§6.3 remains named absence (deferred-work.md). No Sample World. No API nav.

**Non-Functional Requirements Coverage:**
Honesty = disk + empty/error states. Security = allow-list + sanitize, no auth. Performance = request-time walk of three small trees; a multi-second Story open is a defect (PRD). Keyboard UJ-1–UJ-7 via registry + one overlay. WCAG AA target, contrast tokens load-bearing. No scalability/multi-tenant requirement.

### Implementation Readiness Validation ✅

**Decision Completeness:**
Stack versions, port 3011, sibling starter, freshness, status precedence, sanitize, URL dual-nav are written. Closures below fill search payload, cwd, links, unclassified.

**Structure Completeness:**
Concrete `apps/dashboard` tree + root Turbo scripts. Additional files from closures: `src/lib/catalog/resolve-link.ts` (+ test), layout load fields `searchCorpus`.

**Pattern Completeness:**
Naming, errors, anti-patterns, enforcement are specified. Remaining agent forks (status label mapping, test-path→tree map) are closed below.

### Gap Analysis Results

**Critical Gaps (closed in this validation — treat as architecture):**

1. **Layout payload:** `{ trees, tree, snapshot, searchCorpus, tests }`. `snapshot` = selected Tree. `searchCorpus` = all Current BMAD Trees (text + kind + id + tree). Search defaults to all trees; can narrow to `tree`.
2. **`bmad-root.ts`:** resolve workspace root by walking up from `import.meta.dir` / cwd until `_bmad-output/` exists; never assume cwd is the monorepo root.
3. **`resolve-link.ts`:** relative href + source path → in-root Reader URL or `{ unresolved: true }`. Markdown pipeline applies this after sanitize; unresolved class = DESIGN.md destructive.
4. **Unclassified appear** in Docs. Omitted from Delivery and Features. `ArtifactKind` has no `'feature'`.

**Important Gaps (specified here, not blocking):**

- Run folders: directory Artifact; primary file `prd.md` if present, else sibling list (FR-4).
- `/epics/[id]` and `/stories/[id]` require `?tree=`; slug unique per tree.
- Tests: repo-wide list. Tree filter prefixes: `zeo` → `apps/zeo`, `chhan-chhan` → `apps/chhan-chhan`. `pocket-dimension` → no prefix (show full catalog).
- Search hit: `{ kind, id, title, snippet, href, tree }`.
- Status: `status` union + `statusLabel` (raw string when present). Extra sprint-status values map to `unknown` but keep the label.
- `/` does not steal when focus is in an editable field (Search input owns `/` once open).

**Nice-to-Have:** MiniSearch, watcher, Dockerfile, Pocket tile, §6.3 — already deferred.

### Validation Issues Addressed

PRD vs first-pass architecture: search-all-trees vs selected-tree-only load; unclassified hide vs show; missing FR-5 module; Turbo cwd. Resolved as the Critical + Important items above. No remaining contradiction with UX (Overview landing, board default, no dead nav).

### Architecture Completeness Checklist

**Requirements Analysis**

- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**

- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**

- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**

- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** high — small surface, locked non-goals, sibling starter, FR coverage complete once closures above are treated as canon.

**Key Strengths:**
- Read-only filesystem Showcase; no second record
- One parse pipeline, one Delivery projection, dual corpus (BMAD vs tests)
- SIS used as IA only
- Honesty and §6.3 named absences documented

**Areas for Future Enhancement:**
- §6.3 surfaces, test runner, MiniSearch, watcher, deploy artifacts, configurable BMAD Root, Pocket hub tile, Coaching-path public product

### Implementation Handoff

**AI Agent Guidelines:**

- Follow this document; PRD/UX win on product copy and IA
- Do not implement §6.3 or Sample World
- Sanitize on the server; no write-back
- First story is sibling scaffold, not `sv create`, unless copy is blocked

**First Implementation Priority:**
Copy `apps/pocket` → `apps/dashboard` (`@pocket-dimension/dashboard`), strip hub catalog, copy watchlist shadcn/`components.json`, add root `dev:app:dashboard` / `build:app:dashboard`, default `PORT=3011`. Then allow-list + markdown pipeline.
