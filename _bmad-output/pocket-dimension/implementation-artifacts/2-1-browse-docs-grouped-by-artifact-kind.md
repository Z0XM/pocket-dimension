---
story_id: "2.1"
story_key: 2-1-browse-docs-grouped-by-artifact-kind
epic: 2
depends_on: 1-4-land-on-overview-for-the-selected-tree
baseline_commit: ed7442d
---

# Story 2.1: Browse Docs grouped by Artifact Kind

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->
<!-- Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Ubuntu,
I want Artifacts in the selected Tree grouped by Kind,
so that I can find Epics, Stories, docs, and planning packs without knowing the path.

## Acceptance Criteria

1. **Given** a Current BMAD Tree is selected  
   **When** I open Docs  
   **Then** Artifacts are grouped by Artifact Kind: at least Epic, Story, documentation, and other classified Kinds when at least one of that Kind exists (FR-2, UX-DR10)  
   **And** classification uses path/filename first, heuristics second; unknown → `unclassified`  
   **And** `ArtifactKind` is `'epic' | 'story' | 'doc' | 'prd' | 'ux' | 'architecture' | 'unclassified'` — Feature is not a Kind  
   **And** an Artifact appears in exactly one primary Kind; unclassified files appear in Docs, not as invented Features or Delivery rows  
   **And** parsers live in `$lib/catalog` (pure); `fs` / `realpath` only in `$lib/server`  
   **And** the per-navigation `snapshot` is the selected Tree only (NFR-6)

2. **Given** I am in Docs  
   **When** I move among Kind groups  
   **Then** the Catalog stays usable (list remains) so I can pick another Artifact without starting over  
   **And** the active Catalog row uses surface fill + accent left hairline, not a filled violet block (UX-DR4)

3. **Given** a Tree with only unclassified files  
   **When** I open Docs  
   **Then** those files still appear once under unclassified  
   **And** nothing is hidden just because Kind is unknown

## Tasks / Subtasks

- [x] Extend shared types for catalog DTOs (AC: 1)
  - [x] **UPDATE** `apps/dashboard/src/lib/types.ts` — add `ArtifactKind` (no `'feature'`), `ArtifactRef`, `TreeSnapshot`, extend `LayoutTreeData` with `snapshot: TreeSnapshot | null`
  - [ ] Canonical Kind union (epics + architecture closure win over the stale Naming Patterns line that lists `'feature'`):
    ```ts
    export type ArtifactKind =
      | "epic"
      | "story"
      | "doc"
      | "prd"
      | "ux"
      | "architecture"
      | "unclassified";
    ```
  - [ ] `ArtifactRef` fields (camelCase): `id`, `title`, `artifactKind`, `sourcePath` (relative to tree root, posix `/`), optional `error` if a single file fails later — do not invent status/dates here
  - [ ] `TreeSnapshot`: `{ tree: TreeId; artifacts: ArtifactRef[] }` — flat list; grouping is a pure view helper (or derived in Docs). Do **not** add `searchCorpus` / `tests` in this story

- [x] Pure classifier + slug + group helpers in `$lib/catalog` (AC: 1, 3)
  - [x] **NEW** `apps/dashboard/src/lib/catalog/classify.ts` — `classifyArtifact(relativePath: string, contentHint?: string): ArtifactKind`
  - [ ] Path/filename rules **first** (order matters; first match wins). Relative path is tree-root-relative, `/`-separated, no leading slash. Suggested v1 rules covering pocket-dimension / zeo / chhan-chhan conventions:
    | Priority | Kind | Path/filename signals |
    | --- | --- | --- |
    | 1 | `epic` | basename `epics.md` / `epics-*.md`; basename contains `-epic-` (e.g. `9-epic-remove-guest-mode.md`); path ends with `/epics.md` |
    | 2 | `story` | under `implementation-artifacts/` **and** basename matches `^\d+-\d+-` (e.g. `2-1-browse-docs-….md`) |
    | 3 | `prd` | path segment `prds` **or** basename `prd.md` / `prd-*.md` |
    | 4 | `ux` | path includes `ux-designs/` **or** basename is `DESIGN.md` / `EXPERIENCE.md` |
    | 5 | `architecture` | basename matches `/^architecture(\.|-|$)/i` (e.g. `architecture.md`, `architecture-dashboard.md`, `architecture-game-mode.md`) |
    | 6 | `doc` | brownfield / planning leftovers: `project-context.md`, `project-overview.md`, `index.md`, `*-guide.md`, `api-contracts*`, `data-models*`, `component-inventory*`, `source-tree*`, `contribution*`, `deployment*`, `development-guide*`, `deferred-work*`, `addendum.md`, `reconcile-*`, `review-rubric*`, `product-brief*`, `implementation-readiness*`, `sprint-status*` (`.yaml`/`.yml`/`.md`), decision logs under planning when not already matched |
    | 7 | heuristics | only if still unmatched **and** `contentHint` provided — e.g. first heading / frontmatter cues: `# Story` / `## Acceptance Criteria` / `Status:` → `story`; `# Epic` / `### Story` packs titled Epics → `epic`; `# PRD` → `prd`. Keep heuristics narrow; never invent Kind from vibes |
    | 8 | `unclassified` | everything else that is still catalogued |
  - [x] **Feature is never returned** as a Kind. Features remain Epic 3 extraction from planning text, not catalog Kind groups
  - [x] **NEW** `apps/dashboard/src/lib/catalog/slug.ts` — stable `id` from `sourcePath` (kebab/slug; unique per tree). Used by rows and by Story 2.2 routes later
  - [x] **NEW** `apps/dashboard/src/lib/catalog/group-by-kind.ts` (or export from `classify.ts`) — `groupArtifactsByKind(artifacts): { kind: ArtifactKind; label: string; items: ArtifactRef[] }[]` — **omit empty Kinds**; preserve a stable Kind display order: Epic → Story → PRD → UX → Architecture → Doc → Unclassified
  - [x] Screen labels (muted Kind headers): Epic, Story, PRD, UX, Architecture, Doc, Unclassified — not “War Room” / “quests”
  - [x] One Artifact → exactly one Kind. Never duplicate a path across groups

- [x] Golden fixtures + tests (AC: 1, 3)
  - [x] **NEW** `apps/dashboard/src/lib/catalog/fixtures/` — relative-path strings (and tiny content snippets for heuristic cases). Not Sample World UI; not live BMAD copies required — synthetic paths that mirror real conventions
  - [x] **NEW** `apps/dashboard/src/lib/catalog/classify.test.ts` — cover: epic/story/prd/ux/architecture/doc path wins; Feature-like names do **not** become a Kind; ambiguous → unclassified; story under `implementation-artifacts/1-2-….md`; `architecture-dashboard.md`; `ux-designs/.../DESIGN.md`; `prds/.../prd.md`; only-unclassified set still classifies once; no `'feature'` in return type
  - [x] **NEW** `apps/dashboard/src/lib/catalog/slug.test.ts` if slug logic is non-trivial
  - [x] Run: `cd apps/dashboard && bun test src`

- [x] Server tree walk → selected-Tree snapshot (AC: 1, NFR-6)
  - [x] **NEW** `apps/dashboard/src/lib/server/read-tree.ts` — `loadTreeSnapshot(tree: TreeId): TreeSnapshot | { artifacts: []; error?: string }`
  - [x] Resolve tree dir via existing `resolveTreePath` / `resolveBmadRoot` from `bmad-root.ts` — **do not** re-implement allow-list; reject escape with realpath the same way
  - [x] Recursively walk **only the selected tree**. Do not walk sibling trees into `snapshot` (searchCorpus is Epic 4)
  - [x] Include cataloguable text files: `.md`, `.yaml`, `.yml` (sprint-status etc.). Skip: `.html` mockups, images, `.git`, `node_modules`, binary, empty dirs-as-artifacts (run-folder directory Artifacts = Story 2.2 / FR-4)
  - [x] For each file: `sourcePath` = path relative to tree root; `artifactKind = classifyArtifact(sourcePath, optionalHead)`; `id = slug(sourcePath)`; `title` = first markdown `#` heading if cheap to read, else basename without extension
  - [x] Read at most a small prefix for title/heuristics (e.g. first ~4–8 KiB). Do **not** run remark/sanitize (Story 2.2). Do **not** log file bodies — `console.warn` with relative path only on skip/error
  - [x] Single-file read failure: omit or include `{ id, artifactKind: 'unclassified', sourcePath, title, error }` — **do not** fail the whole snapshot. Whole page fails only if tree root unreadable (layout already handles BMAD Root missing)
  - [x] No file watcher; request-time only (NFR-6)

- [x] Wire snapshot into layout load (AC: 1)
  - [x] **UPDATE** `apps/dashboard/src/routes/+layout.server.ts` — after resolving `tree`, call `loadTreeSnapshot(tree)` when `tree` is non-null; return `{ trees, tree, bmadRootError, snapshot }`
  - [x] When `tree` is null / BMAD Root error: `snapshot: null` (or empty artifacts) — do not invent Sample World
  - [x] Keep flat DTO (no `{ data, error }` envelope). Do **not** add `searchCorpus` / `tests` yet
  - [x] **UPDATE** `+layout.svelte` / `app-shell` only if props typing requires it — shell does **not** need to render catalog; passing `trees`/`tree`/`bmadRootError` unchanged is fine. Prefer not bloating shell props with full snapshot unless needed

- [x] Docs Catalog UI Kind groups (AC: 1–3, UX-DR4, UX-DR10)
  - [x] **UPDATE** `apps/dashboard/src/routes/docs/+page.svelte` — replace Epic 1 stub (“Docs catalog arrives in Epic 2”) with Kind-grouped Catalog from `data.snapshot`
  - [x] **NEW** `apps/dashboard/src/lib/components/docs-catalog.svelte` (kebab-case) — renders Kind sections + rows; receives `artifacts` / groups + `tree` + `activePath`
  - [x] Show a Kind section **only when** that Kind has ≥1 Artifact
  - [x] Row: title (body/label), muted `sourcePath` or Kind meta; keyboard-focusable native control
  - [x] Active row: `border-l-2 border-accent` + `bg-card` / surface fill + foreground text — **not** `bg-accent` / filled violet block (match `section-nav` / DESIGN Catalog row)
  - [x] Inactive: transparent left border + muted text
  - [x] Catalog remains mounted while changing active row / Kind groups (list does not unmount into a single-doc-only view)
  - [x] Empty tree (zero files): keep a short honest empty (“No Docs in this Tree.”) — full empty/missing polish is Story 2.4; do not invent Sample World
  - [x] Unclassified-only tree: one Unclassified group; every file listed once

- [x] Reader / open seam for Story 2.2 (document + prepare; do not implement Reader) (AC: 2)
  - [x] Architecture pairs list+select with `/docs/[...path]` + Reader. **This story owns Catalog grouping only.**
  - [ ] Preferred seam (pick one and stick to it):
    1. **Recommended:** Catalog rows are `<a>` whose `href` targets `/docs/{sourcePath}?tree={tree}` (encode path segments). Active state for 2.1 uses a Docs-local query such as `?tree=&artifact=` **or** client `$state` selected `sourcePath` so `/docs/[...path]` is **not** required yet and does not 404.
    2. Do **not** implement `docs/[...path]/+page.*`, `markdown.ts`, `markdown-reader.svelte`, or remark/sanitize here.
    3. Document in code comment on `docs-catalog.svelte`: Story 2.2 attaches Reader at `/docs/[...path]`, switches active detection to `page.url.pathname`, keeps the same `ArtifactRef.sourcePath` / `id` / Kind grouping.
  - [x] Clicking a row may set active hairline without leaving `/docs` — satisfies “Catalog stays usable.” Opening structured markdown is **out of scope** (2.2)

- [x] Preserve Epic 1 contracts (regression)
  - [x] Health `GET /health` → `{"status":"ok"}`; port **3011**; no auth/DB; no write APIs
  - [x] Closed allow-list + `bmad-root.ts` behavior unchanged
  - [x] DESIGN tokens + Fira Code + section nav five items unchanged
  - [x] Stub Features / Delivery / Tests remain empty stubs (no Feature Kind rows; no Delivery projection)
  - [x] Do **not** edit `apps/pocket/**`, rhymes `sprint-status.yaml`, non-dashboard `epics.md` / `architecture.md`
  - [x] Tracking file: only `sprint-status-dashboard.yaml`

- [x] Verify (AC: 1–3)
  - [x] `cd apps/dashboard && bun test src` — classify (+ slug) goldens pass; existing bmad-root + nav tests still pass
  - [x] `cd apps/dashboard && bun run check`
  - [x] `bun run dev:app:dashboard` — `/docs?tree=pocket-dimension` shows Kind groups (Epic, Story, PRD, UX, Architecture, Doc, Unclassified as present); dashboard’s own epics/PRD/UX/architecture appear under correct Kinds (dogfood readiness; FR-10 open-in-Reader is 2.2/2.4)
  - [x] Switch `?tree=zeo` / `chhan-chhan` — snapshot and groups change; no leftover trees
  - [x] Active row = surface + accent hairline, not violet fill
  - [x] Move among Kind groups / rows — list remains
  - [x] `curl -sS http://localhost:3011/health` still OK

## Dev Notes

### Scope boundary (critical)

| In scope | Out of scope (later) |
| --- | --- |
| `classify.ts` + path/heuristic rules + goldens | `markdown.ts` / remark → rehype-sanitize / `{@html}` (2.2) |
| `read-tree.ts` walk + selected-Tree `snapshot` | `docs/[...path]` Reader route + structured markdown (2.2) |
| Docs Kind-grouped Catalog UI + active hairline | `resolve-link.ts` / unresolved links (2.3) |
| Layout load adds `snapshot` only | Empty/missing polish beyond basic listing (2.4); “Unreadable Artifact.” Reader copy |
| `slug.ts` for stable Artifact ids | Features extractor / Feature Kind (never a Kind; Epic 3) |
| | Delivery projection / board / status (Epic 3) |
| | Search overlay / `searchCorpus` / tests catalog (Epic 4) |
| | Run-folder directory Artifact + `prd.md` primary (FR-4 → 2.2) |
| | File watcher, MiniSearch, Sample World, write-back, auth |

### Architecture conflict — `'feature'` in Kind union

Architecture **Naming Patterns** once listed `'feature'` inside Kind-in-code. Architecture **Gap Analysis closure #4**, epics Additional Requirements, and PRD FR-2 / this story all say: **`ArtifactKind` has no `'feature'`**. Feature is a **surface/extraction**. Implement the closure. Do not add a Feature group in Docs.

### Current UPDATE / NEW files (read before editing)

State after Story 1.4 (`baseline_commit` ≈ `ed7442d`):

| File | Current state | This story changes | Must preserve |
| --- | --- | --- | --- |
| `src/lib/types.ts` | `TreeId`, `LayoutTreeData` (`trees`, `tree`, `bmadRootError`) | Add `ArtifactKind`, `ArtifactRef`, `TreeSnapshot`; extend layout data with `snapshot` | Existing tree fields |
| `src/routes/+layout.server.ts` | `{ trees, tree, bmadRootError }` via `listCurrentTrees` | Load `snapshot` for selected `tree` via `read-tree` | Invalid tree → first allow-listed; no watcher |
| `src/routes/docs/+page.svelte` | Stub empty + “Docs catalog arrives in Epic 2.” | Kind-grouped Catalog from `snapshot` | Quiet type ramp; `?tree=` context; no Sample World |
| `src/lib/server/bmad-root.ts` | Allow-list + realpath | Prefer **untouched**; `read-tree` calls it | Walk-up root; three tree ids |
| `src/routes/+page.svelte` | Overview FR-17 links | Prefer **untouched** (counts from snapshot optional — **not required**) | No fake counts |
| `src/lib/components/section-nav.svelte` | Accent hairline active | Prefer **untouched**; Docs Catalog row mirrors this pattern | Five sections only |
| `src/lib/nav.ts` / tests | Section registry | Untouched | No §6.3 labels |
| `src/app.css` / fonts | DESIGN tokens | Do not restyle chrome | Hex brand layer |
| `src/routes/health/+server.ts` | `{ status: "ok" }` | Do not change | Health contract |

**NEW (required):**

| File | Role |
| --- | --- |
| `src/lib/catalog/classify.ts` | Pure path → `ArtifactKind` (+ optional content heuristic) |
| `src/lib/catalog/classify.test.ts` | Golden path/heuristic cases |
| `src/lib/catalog/slug.ts` | Stable id from `sourcePath` |
| `src/lib/catalog/fixtures/*` | Relative-path / snippet fixtures for tests |
| `src/lib/catalog/group-by-kind.ts` | Omit-empty Kind sections helper (may live next to classify) |
| `src/lib/server/read-tree.ts` | fs walk + classify → `TreeSnapshot` |
| `src/lib/components/docs-catalog.svelte` | Kind groups + Catalog rows |

**Optional NEW:** `src/lib/server/read-tree.test.ts` if walk helpers are unit-testable with a temp dir; otherwise rely on classify goldens + manual Docs check.

**Do not create yet:** `markdown.ts`, `markdown-reader.svelte`, `docs/[...path]/*`, `resolve-link.ts`, `features.ts`, `delivery.ts`, `tests-catalog.ts`, `search-overlay.svelte`, `keyboard.ts`, `/epics/[id]`, `/stories/[id]`, `/timeline`.

### Architecture compliance

- Data flow: disk (allow-list) → `read-tree` → `classify` → Docs Catalog — [Source: architecture-dashboard.md — Data Flow]
- `$lib/catalog` = pure (no `fs`); `$lib/server` = fs + realpath only
- Layout freshness: per-navigation snapshot; selected Tree only (NFR-6). `searchCorpus` deferred
- Success load shape flat: `{ trees, tree, bmadRootError, snapshot }`
- Fail single Artifact without failing page; fail page only if allow-list root unreadable
- Unclassified appear in Docs; omitted from Delivery/Features (those surfaces stay stubs)
- Routes stay `/docs` for this story; `/docs/[...path]` is the 2.2 attachment point
- Logging: warn with relative path; never dump file bodies
- Named absences: Sample World, API nav, Blockers, Questions, Deferred, write-back, auth, watcher

### Library / framework requirements

- Stack unchanged: Svelte 5 runes, SvelteKit 2 (`^2.49.1`), Bun, Tailwind 4, shadcn already present, `@fontsource/fira-code`
- **Do not** add `remark-gfm`, `rehype-sanitize`, marked, or DOMPurify in this story (2.2)
- **Do not** add MiniSearch, Drizzle, Better Auth, or new UI libraries
- Tests: `bun:test` co-located; `package.json` script already `"test": "bun test src"`
- Prefer `$app/stores` `page` consistency with `section-nav` / `tree-switcher` if reading query for active artifact
- Build Docs links with `URL` / `searchParams` so `tree` is never dropped

### Project Structure Notes

```
apps/dashboard/src/
  lib/
    types.ts                      # UPDATE — ArtifactKind, ArtifactRef, TreeSnapshot, layout.snapshot
    catalog/                      # NEW dir — PURE
      classify.ts
      classify.test.ts
      slug.ts
      group-by-kind.ts            # or export from classify
      fixtures/                   # golden relative paths / snippets
    server/
      bmad-root.ts                # PRESERVE
      bmad-root.test.ts           # PRESERVE
      read-tree.ts                # NEW — fs walk + snapshot
    components/
      docs-catalog.svelte         # NEW
      section-nav.svelte          # PRESERVE (pattern reference for hairline)
      app-shell.svelte            # PRESERVE unless props must widen
    nav.ts                        # PRESERVE
  routes/
    +layout.server.ts             # UPDATE — add snapshot
    +layout.svelte                # PRESERVE / minor typing
    docs/+page.svelte             # UPDATE — Catalog UI
    docs/[...path]/              # DO NOT ADD (2.2)
```

Conflict note: three trees, three folder conventions — classifier **must not** assume only pocket-dimension naming. Path rules above cover zeo (`epics-game-mode.md`, `N-N-*.md`, `architecture-game-mode.md`) and chhan-chhan (`prds/.../prd.md`, fewer `N-N-` stories → more `doc` / `unclassified`).

Conflict note: rhymes story files also live under `pocket-dimension/implementation-artifacts/` with `N-N-*.md` names. They correctly classify as **`story`** Kind (BMAD Story Artifacts). Do not special-case dashboard vs rhymes filenames.

### Previous story intelligence (1.1 → 1.4)

- **1.1:** pocket sibling `@pocket-dimension/dashboard` on **3011**; hub stripped; shadcn installed; deploy files deleted — do not resurrect
- **1.2:** DESIGN.md tokens + Fira Code; `app-shell` rail/sheet; quiet chrome
- **1.3:** closed allow-list `bmad-root.ts`; layout `{ trees, tree, bmadRootError }`; Vite SSR walk-up via `import.meta.url` / cwd — **do not break**; explicitly deferred `read-tree` / `classify` / snapshot to Epic 2
- **1.4:** `nav.ts` + `section-nav` hairline; Overview FR-17; stub `/docs` empty copy — **this story replaces Docs stub with real Catalog**; Features/Delivery/Tests stubs remain
- 1.4 completion: `bun test src` (15 pass) + `bun run check` clean; run checks **inside** `apps/dashboard`
- Dashboard tracking only: `sprint-status-dashboard.yaml` (never rhymes `sprint-status.yaml`)

### Git intelligence

Recent commits on `cursor/dashboard-epic-1-66a2`:

- `ed7442d` — story 1.4 Overview + section nav + stub routes
- `ca51c29` — story 1.3 allow-list trees + switcher + layout load
- `fcc8d37` — story 1.2 quiet dark chrome
- `630dce2` / `b5f43bb` — planning + story 1.1 scaffold

Implement atop 1.4; do not re-scaffold, re-token, or re-open allow-list design.

### Latest tech information

- Node `fs` recursion: prefer `readdir` + `stat`/`lstat` with realpath checks against tree root (same escape discipline as `resolveTreePath`)
- SvelteKit 2 layout load runs per navigation — ideal for NFR-6 snapshot refresh; do not cache in `localStorage` / `sessionStorage`
- Active Catalog row CSS: mirror section-nav (`border-l-2 border-accent bg-card`) — DESIGN.md Catalog row, not `bg-primary` fill
- Path encoding for future `/docs/[...path]`: keep `sourcePath` as relative posix; 2.2 will split on `/` for rest params — do not use Windows separators in DTOs
- No new markdown packages until 2.2; title extraction = lightweight string scan for `/^#\s+.+/m` only

### Testing requirements

Automated:

```bash
cd apps/dashboard
bun test src          # classify (+ slug) goldens; bmad-root + nav must still pass
bun run check         # types clean with snapshot on layout + Docs UI
```

Manual:

```bash
bun run dev:app:dashboard
# /docs?tree=pocket-dimension → Kind groups present; epics-dashboard / story files / prd / ux / architecture visible under correct Kinds
# Select rows / move across Kind headers → Catalog list remains; active = surface + accent hairline
# ?tree=zeo → different snapshot; chhan-chhan → PRD/UX/architecture/doc mix; unclassified still listed if any
# Features/Delivery/Tests still stubs (no Feature Kind invented on Docs)
curl -sS http://localhost:3011/health   # {"status":"ok"}
```

Fail if: Feature appears as ArtifactKind; Artifacts duplicated across Kinds; unclassified hidden; `fs` imported from `$lib/catalog`; snapshot includes other trees; Reader/remark/`docs/[...path]` implemented “while here”; filled violet active rows; Sample World; health/port/auth regressions; rhymes `sprint-status.yaml` edited.

### Anti-patterns (do not)

- Returning `'feature'` from `classifyArtifact`
- Putting `fs` / `path` / `realpath` inside `$lib/catalog`
- Scanning all three trees into `snapshot` (that is `searchCorpus`, Epic 4)
- Implementing markdown sanitize + Reader in this story
- Inventing Delivery rows / Feature rows from Docs classification
- Filled violet / `bg-accent` Catalog active blocks
- File watcher or `localStorage` snapshot cache
- Globbing leftover `_bmad-output/*` trees beyond allow-list
- Logging full markdown bodies on parse skip
- Editing rhymes `sprint-status.yaml` or non-dashboard epics/architecture
- Hiding unclassified files “until we know Kind”
- Treating HTML mockups under `ux-designs/mockups/` as required Catalog entries (skip non-md/yaml)

### Empty / error / loading copy (EXPERIENCE voice)

| State | Copy |
| --- | --- |
| Docs with Artifacts | Kind headers + rows (no marketing filler) |
| Docs zero files | “No Docs in this Tree.” (basic; 2.4 polishes) |
| Cold load | “Reading BMAD…” in main only (already on Overview; optional on Docs if navigating) |
| BMAD Root missing | Keep shell: “BMAD Root unavailable.” (1.3) |
| Single file unreadable | Skip or row with error; Catalog continues (full Reader error copy = 2.2/2.4) |

Do **not**: “Oops!”, Sample World offers, “War Room”, “quests”.

### References

- [Source: planning-artifacts/epics-dashboard.md — Story 2.1, Epic 2, FR-2, NFR-6, UX-DR4, UX-DR10, ArtifactKind union, `$lib/catalog` vs `$lib/server`]
- [Source: planning-artifacts/architecture-dashboard.md — classify.ts, read-tree.ts, catalog/ fixtures, layout snapshot, unclassified-in-Docs closure, anti-patterns, project tree]
- [Source: planning-artifacts/ux-designs/ux-dashboard-2026-08-23/DESIGN.md — Catalog row active = surface + accent hairline]
- [Source: planning-artifacts/ux-designs/ux-dashboard-2026-08-23/EXPERIENCE.md — Docs rail + Reader IA; Flow 2 Docs; voice/tone]
- [Source: planning-artifacts/prds/prd-dashboard-2026-08-23/prd.md — FR-2 Browse by Artifact Kind; Catalog definition]
- [Source: planning-artifacts/prds/prd-dashboard-2026-08-23/addendum.md — Docs + Reader taken from SIS; Sample World excluded]
- [Source: implementation-artifacts/1-4-land-on-overview-for-the-selected-tree.md — Docs stub; section-nav hairline pattern; deferred classify/read-tree]
- [Source: implementation-artifacts/1-3-switch-among-current-bmad-trees-only.md — trees/tree load; deferred snapshot]
- [Source: apps/dashboard/src/routes/+layout.server.ts — UPDATE baseline]
- [Source: apps/dashboard/src/routes/docs/+page.svelte — UPDATE baseline stub]
- [Source: apps/dashboard/src/lib/server/bmad-root.ts — allow-list API for read-tree]
- [Source: apps/dashboard/src/lib/types.ts — UPDATE baseline]
- [Source: _bmad-output/README.md — closed Current BMAD Trees]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Added pure `$lib/catalog` classifier (path-first, no `'feature'` Kind), slug helper, and `groupArtifactsByKind` with stable Kind order and empty-group omission.
- Added `read-tree.ts` server walk for selected-tree snapshot wired into layout load; Docs page renders Kind-grouped catalog with section-nav hairline active pattern and `?artifact=` selection seam for Story 2.2.
- 31 tests pass (`bun test src`); `bun run check` clean; manual curl verified Kind groups on pocket-dimension, zeo, chhan-chhan trees and health endpoint.

### File List

- apps/dashboard/src/lib/types.ts
- apps/dashboard/src/lib/catalog/classify.ts
- apps/dashboard/src/lib/catalog/classify.test.ts
- apps/dashboard/src/lib/catalog/slug.ts
- apps/dashboard/src/lib/catalog/slug.test.ts
- apps/dashboard/src/lib/catalog/group-by-kind.ts
- apps/dashboard/src/lib/catalog/fixtures/paths.ts
- apps/dashboard/src/lib/server/read-tree.ts
- apps/dashboard/src/lib/components/docs-catalog.svelte
- apps/dashboard/src/routes/+layout.server.ts
- apps/dashboard/src/routes/docs/+page.svelte
- _bmad-output/pocket-dimension/implementation-artifacts/2-1-browse-docs-grouped-by-artifact-kind.md
- _bmad-output/pocket-dimension/implementation-artifacts/sprint-status-dashboard.yaml

## Change Log

- 2026-08-23: Story 2.1 context created (ready-for-dev) — Docs Kind-grouped Catalog, classify + read-tree snapshot, Reader seam deferred to 2.2.
- 2026-08-23: Story 2.1 implemented — Docs catalog grouped by Artifact Kind; classify + read-tree snapshot; 31 tests pass.
