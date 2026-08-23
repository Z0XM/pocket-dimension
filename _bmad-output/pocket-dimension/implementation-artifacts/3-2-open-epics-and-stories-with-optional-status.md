---
story_id: "3.2"
story_key: 3-2-open-epics-and-stories-with-optional-status
epic: 3
depends_on: 3-1-browse-features-extracted-from-planning-artifacts
baseline_commit: e517759
---

# Story 3.2: Open Epics and Stories with optional status

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->
<!-- Validation skipped per create-story invocation (skip validate-story workflow). -->

## Story

As Ubuntu,
I want to open an Epic and its Stories,
so that I can read implementation work in context instead of as paths.

## Acceptance Criteria

1. **Given** Epic Artifacts exist in the selected Tree  
   **When** I view them as Kind Epic (Docs or Delivery)  
   **Then** they are listed as Artifact Kind Epic (FR-7)  
   **And** `/epics/[id]?tree=` opens that Epic in the Reader  
   **And** `[id]` is a slug from path/filename, unique per tree (`slugFromSourcePath` / `ArtifactRef.id`)

2. **Given** I am on an Epic that references Stories by existing links or filenames  
   **When** those Story files exist  
   **Then** I can open each referenced Story (no separate story-index schema)  
   **And** a missing referenced Story does not hide the Epic; the broken ref is unresolved or omitted, not invented

3. **Given** Story Artifacts exist  
   **When** I list or open one  
   **Then** they are listed as Artifact Kind Story (FR-8)  
   **And** `/stories/[id]?tree=` opens the Story in the Reader  
   **And** title is visible in the Catalog or Reader header  
   **And** status is shown when present (`Status:` line or later Delivery projection); Stories without status still list and open  
   **And** there is a way back via Delivery (UX-DR11) once Delivery exists; until 3.3, back via Docs/nav is enough

## Tasks / Subtasks

- [x] Pure status parse (AC: 3) — **do not** implement sprint-status.yaml precedence (that is 3.3)  
  - [x] **NEW** `apps/dashboard/src/lib/catalog/status.ts` — pure helpers, no `fs`:

    ```ts
    export type StoryStatus = "backlog" | "in-progress" | "done" | "unknown";

    /** Raw Status: line when present; never invent. */
    export function extractStatusLine(markdown: string): string | null;

    /** Map common labels → union; extras → "unknown" but keep statusLabel. */
    export function mapStatusLabel(raw: string): { status: StoryStatus; statusLabel: string };
    ```

  - [x] Match first line-like cue in the head (same spirit as classify heuristics):  
    - `^Status:\s*(.+)\s*$` (BMAD story files)  
    - optional `^\*\*Status:\*\*\s*(.+)\s*$` (some zeo epic packs) — only for display if present; do not invent columns  
  - [x] Strip markdown bold/backticks from the captured label; trim. Empty → treat as absent.  
  - [x] Mapping (v1, align architecture):  
    | Raw (case-insensitive, after strip) | `status` |
    | --- | --- |
    | `backlog` | `backlog` |
    | `ready-for-dev`, `in-progress`, `review`, `contexted` | map ready-for-dev/review/contexted → `in-progress` **or** `unknown` with label kept — prefer **`unknown` + statusLabel** for non-board values so 3.3 board columns stay backlog→done; **do not** invent new columns |
    | `done`, `complete`, `completed` | `done` |
    | anything else | `unknown` + raw `statusLabel` |
  - [x] **Critical for 3.2 Catalog chip:** Showing the **raw `statusLabel`** (or a tiny muted chip with that string) satisfies AC when a `Status:` line exists. The union is for typing forward-compat with Delivery; do not build board columns here.  
  - [x] **NEW** `apps/dashboard/src/lib/catalog/status.test.ts` — fixtures for `Status: done`, `Status: ready-for-dev`, `**Status:** complete`, missing line → `null`, never invent.

- [x] Extend DTOs for optional status (AC: 3)  
  - [x] **UPDATE** `apps/dashboard/src/lib/types.ts` — on `ArtifactRef` add optional:

    ```ts
    status?: StoryStatus;      // only when Status: (or later Delivery) present
    statusLabel?: string;      // raw string when present
    ```

  - [x] Do **not** add DeliveryItem / board types in this story.  
  - [x] Feature remains not an `ArtifactKind`.

- [x] Snapshot: attach status for Story (and optionally Epic) Kind only (AC: 1, 3)  
  - [x] **UPDATE** `apps/dashboard/src/lib/server/read-tree.ts` `buildArtifact` — after classify, if `artifactKind === "story"` (and optionally `"epic"` when a Status line exists), call `extractStatusLine(head)` + `mapStatusLabel`; set `status` / `statusLabel` only when extract returns non-null.  
  - [x] Files without Status: omit fields; still list and open.  
  - [x] Unreadable file path still returns ArtifactRef with `error` (existing); do not invent status.

- [x] Resolve Artifact by slug for epic/story routes (AC: 1, 3)  
  - [x] **NEW** `apps/dashboard/src/lib/server/load-by-slug.ts` (or helpers in `read-artifact.ts`) — given `tree`, `id`, expected Kind `"epic" | "story"`:  
    1. Require tree.  
    2. Find in `loadTreeSnapshot(tree).artifacts` where `artifact.id === id`.  
    3. If missing → error DTO (“Artifact not found.” / Unreadable).  
    4. If Kind mismatch (e.g. story id on `/epics/`) → Unreadable with clear reason; do not open wrong Kind.  
    5. `loadArtifact(tree, artifact.sourcePath)` — **reuse** existing sanitize/Reader pipeline.  
  - [ ] Slug algorithm: **only** existing `slugFromSourcePath` — never invent UUIDs or short aliases. Live examples:  
    - Epic: `planning-artifacts--epics-dashboard` ← `planning-artifacts/epics-dashboard.md`  
    - Story: `implementation-artifacts--3-1-browse-features-extracted-from-planning-artifacts`

- [x] Routes `/epics/[id]` and `/stories/[id]` (AC: 1, 3)  
  - [x] **NEW** `apps/dashboard/src/routes/epics/[id]/+page.server.ts`  
  - [x] **NEW** `apps/dashboard/src/routes/epics/[id]/+page.svelte`  
  - [x] **NEW** `apps/dashboard/src/routes/stories/[id]/+page.server.ts`  
  - [x] **NEW** `apps/dashboard/src/routes/stories/[id]/+page.svelte`  
  - [x] Query: **require** `?tree=` (from layout parent already resolves invalid → first allow-listed tree). Page title: `dashboard · Epic · {title}` / `dashboard · Story · {title}`.  
  - [x] Render with existing `MarkdownReader` — pass `title`, `sourcePath`, `kindLabel` (`Epic` / `Story`), and when status present append muted status in header (extend `markdown-reader.svelte` with optional `statusLabel?: string` **or** compose a thin wrapper; do not fork a second Reader).  
  - [x] Error path: `HonestState` + `EXPERIENCE_COPY.unreadableArtifact` + reason (same as Docs).  
  - [x] Run-folder / yaml are not expected on these routes; if somehow classified, still go through `loadArtifact` honesty.  
  - [x] **Back nav until 3.3:** link to Docs (`sectionHref("/docs", tree)`) and/or Overview; optional muted “Epics & Stories” pointing at `/delivery?tree=` stub is OK but **do not** implement board/table/timeline. UX-DR11 full “way back via Delivery” lands in 3.3.

- [x] Docs Catalog: Kind Epic/Story open via slug routes (AC: 1, 3)  
  - [x] **UPDATE** `apps/dashboard/src/lib/components/docs-catalog.svelte` — for `artifactKind === "epic"` href = `/epics/${item.id}?tree=…`; for `"story"` → `/stories/${item.id}?tree=…`; all other Kinds keep `/docs/{encodePathSegments(sourcePath)}?tree=…`.  
  - [x] Show title (already). When `statusLabel` present on Story (and Epic if set), show a tiny muted status chip/text under title — DESIGN.md: “No pills except a tiny status chip if a Story has status.” Use existing `badge` sparingly or muted mono text; no decorative color parade.  
  - [x] Active row: when pathname is `/epics/...` or `/stories/...`, Catalog is not mounted (routes are outside `docs/+layout`) — that is expected. Opening from Docs navigates away from Docs chrome into the dedicated Reader page; return via section nav Docs.  
  - [x] Preserve Kind group headers Epic / Story (already from 2.1).

- [x] Epic → Story refs without a story-index schema (AC: 2)  
  - [x] **Primary:** existing in-body markdown links already go through `resolve-link` → Reader. **UPDATE** `apps/dashboard/src/lib/catalog/resolve-link.ts` so when the resolved target path **classifies as** `story` / `epic` (call `classifyArtifact(resolvedPath)` — path-only, no fs), build href as `/stories/{slugFromSourcePath(path)}?tree=` or `/epics/{slug}…` instead of `/docs/…`. Preserve hash/query behavior. Missing target still `{ unresolved: true }` (never invent).  
  - [x] **Secondary (optional, keep pure):** if useful for epics that mention `` `implementation-artifacts/N-N-….md` `` without a markdown link, a pure scan helper may list openable story paths that **already exist in the snapshot** — omit unknowns; do **not** map `### Story 3.1` headings to files by number alone (that invents a schema). Prefer omitting over guessing.  
  - [x] **Do not** create `story-index.yaml`, Delivery projection, or parent/child Epic↔Story graph tables.  
  - [x] Missing linked Story: unresolved styling stays (story 2.3); Epic page still renders.

- [x] Preserve Epic 1–3.1 contracts (regression)  
  - [x] `/docs/[...path]` continues to open any Artifact by path (including epics/stories) — dual entry is fine; do not remove Docs path open.  
  - [x] Features surface unchanged; Feature still not a Kind.  
  - [x] Delivery / Tests remain stubs — **no** `delivery.ts`, board, table, timeline, `/timeline` redirect beyond what already exists as stub.  
  - [x] Health `GET /health` → `{"status":"ok"}`; port **3011**; no auth/DB; no write APIs; no status write-back.  
  - [x] Tracking: only `sprint-status-dashboard.yaml` — never rhymes `sprint-status.yaml`.  
  - [x] Do not edit `apps/pocket/**` or invent Sample World.

- [x] Verify (AC: 1–3)  
  - [x] `cd apps/dashboard && bun test src`  
  - [x] `cd apps/dashboard && bun run check`  
  - [x] Manual `?tree=pocket-dimension`: Docs → Kind Epic lists `epics-dashboard` / `epics`; open → `/epics/planning-artifacts--epics-dashboard?tree=pocket-dimension` renders Reader.  
  - [x] Docs → Kind Story lists stories; open → `/stories/implementation-artifacts--3-1-…?tree=…`; title in header; `Status: done` (or ready-for-dev) visible when file has Status line.  
  - [x] Story without Status still lists and opens.  
  - [x] Bad id `/epics/nope?tree=pocket-dimension` → Unreadable Artifact, chrome intact.  
  - [x] `?tree=zeo`: epic packs + `N-epic-*.md` open; stories open with optional status.  
  - [x] `?tree=chhan-chhan`: no Epic/Story Kind groups (omit empty) — not fake rows.  
  - [x] Features + Docs other Kinds still work; `/health` OK.

## Dev Notes

### Scope boundary (critical)

| In scope | Out of scope (later / never) |
| --- | --- |
| `/epics/[id]?tree=` + `/stories/[id]?tree=` Reader pages | Delivery board / table / Timeline (3.3) |
| Catalog Kind Epic/Story → slug routes | `delivery.ts` status precedence vs sprint-status.yaml |
| Optional `Status:` display on Catalog/Reader | Drag-to-change status / write-back |
| resolve-link prefers `/epics|/stories` when Kind matches | Search overlay Epic/Story groups (Epic 4) |
| Reuse `markdown-reader` + `loadArtifact` | Second story-index schema; inventing missing Stories |
| Docs/nav as back-path until 3.3 | Sample World, auth, Pocket edits |

### Exhaustive current-state analysis (read before coding)

**Baseline tip `e517759` (story 3.1 done; epic/story routes absent).**

#### Classify / slug (already done — reuse, do not reinvent)

| Module | Behavior | 3.2 use |
| --- | --- | --- |
| `catalog/classify.ts` | Path-first: `epics.md` / `epics-*.md` / `-epic-` → `epic`; `implementation-artifacts/` + `^\d+-\d+-` → `story`; heuristics `# Story` / `Status:` / `# Epic` | Kind list + route Kind check + resolve-link Kind prefer |
| `catalog/slug.ts` | `slugFromSourcePath` → `planning-artifacts--epics-dashboard` | `[id]` param; unique per tree |
| `catalog/group-by-kind.ts` | Labels Epic / Story; omit empty | Docs already lists Kind Epic/Story |
| `read-tree.ts` | `ArtifactRef.id = slugFromSourcePath`; title from `#` heading | Lookup by id; title for Catalog/Reader |

Live snapshot counts (request-time walk): pocket-dimension ~2 epics / ~27 stories; zeo ~6 epics / ~30 stories; chhan-chhan 0 / 0.

#### `/docs` routes today (preserve)

```
docs/+layout.svelte          # Catalog rail + children
docs/+page.svelte            # “Select an Artifact.”
docs/[...path]/+page.server.ts  # loadArtifact(tree, decodePathParam)
docs/[...path]/+page.svelte     # MarkdownReader | run-folder | text | HonestState
```

- Catalog `rowHref` → **always** `/docs/{path}?tree=` today — **change Epic/Story rows only**.  
- `markdown-reader.svelte` already accepts `kindLabel`; Docs page does not pass it yet — epic/story pages should.  
- `resolve-link` always builds `/docs/…` Reader URLs — **prefer Kind routes** when target classifies as epic/story.  
- Dual-open OK: `/docs/implementation-artifacts/3-1-….md?tree=` must keep working.

#### Architecture routes (canon)

- Paths: `/epics/[id]`, `/stories/[id]` require `?tree=`; `[id]` = stable slug from path/filename — [Source: architecture-dashboard.md Naming + Important Gaps]  
- Files: `routes/epics/[id]/+page.{server.ts,svelte}`, `routes/stories/[id]/+page.{server.ts,svelte}` — [Source: architecture project tree]  
- Shared pipeline: disk → classify → markdown sanitize → load DTO → Reader — do not parse markdown a second way on the client  
- Status union + `statusLabel`; never invent; full sprint-status precedence is Delivery (3.3)  
- Ignore stale Naming Patterns line that lists `'feature'` in Kind — **canonical union has no `'feature'`**

#### UX / PRD

- FR-7 / FR-8; UJ-1 Epic → Story; UX-DR11 way back via Delivery (defer full Delivery link until 3.3; Docs/nav enough)  
- EXPERIENCE Flow 1; Kind names Epic / Story; tiny status chip only when present  
- Empty: omit empty Kind groups (Docs already); Unreadable for bad slug  

#### Epic→Story reality (HALT risk — honesty)

Most BMAD Epic markdown files **do not** contain markdown links to Story files (e.g. `epics-dashboard.md` uses `### Story 3.2:` headings only; zeo `9-epic-*.md` lists story sections without `N-N-*.md` links). Per AC/PRD: **only** existing links/filenames — **do not** invent a heading→file mapper. Opening Stories from Docs Kind Story + `/stories/[id]` fully satisfies FR-8; Epic body unresolved/missing links stay unresolved/omitted.

### Project Structure Notes

```
apps/dashboard/src/
  lib/
    types.ts                         # UPDATE — optional status fields on ArtifactRef
    catalog/
      classify.ts                    # PRESERVE
      slug.ts                        # PRESERVE — [id] source of truth
      status.ts                      # NEW — extractStatusLine + mapStatusLabel
      status.test.ts                 # NEW
      resolve-link.ts                # UPDATE — prefer /epics|/stories by Kind
      resolve-link.test.ts           # UPDATE
      group-by-kind.ts               # PRESERVE
    server/
      read-tree.ts                   # UPDATE — attach status when Status: present
      read-artifact.ts               # PRESERVE loadArtifact; optional load-by-slug helper
      load-by-slug.ts                # NEW (optional) — snapshot id + Kind → loadArtifact
      markdown.ts                    # PRESERVE
    components/
      markdown-reader.svelte         # UPDATE — optional statusLabel in header
      docs-catalog.svelte            # UPDATE — Kind Epic/Story hrefs + status chip
      honest-state.svelte            # REUSE
  routes/
    docs/**                          # PRESERVE path Reader; Catalog hrefs change for Kind
    epics/[id]/+page.server.ts      # NEW
    epics/[id]/+page.svelte         # NEW
    stories/[id]/+page.server.ts    # NEW
    stories/[id]/+page.svelte       # NEW
    delivery/+page.svelte            # PRESERVE stub — do not implement 3.3
    features/**                      # PRESERVE
```

Conflict note: rhymes files like `3-2-add-rich-inline-body-styling-controls.md` share the `3-2-` prefix — **this** story file is dashboard-only (`3-2-open-epics-and-stories-with-optional-status.md`). Track only `sprint-status-dashboard.yaml`.

Conflict note: Do **not** flip 3.3 or epic-3 to done; only `3-2-…` → `ready-for-dev`; `epic-3` stays `in-progress`.

### Previous story intelligence (3.1 + Epic 2)

- **3.1:** Features extract + `/docs` Reader with hash; Feature ≠ Kind; `$lib/catalog` pure / `$lib/server` fs; honest empty via `experience-copy`; left epic/story routes explicitly out of scope.  
- **2.1:** Kind Epic/Story already in Catalog; `slugFromSourcePath` + classify golden tests.  
- **2.2:** `loadArtifact` + `MarkdownReader` + heading ids.  
- **2.3:** `resolve-link` unresolved class; preserve `#hash`.  
- **2.4:** Unreadable + empty Docs; Features stub filled in 3.1.  
- Do not reopen classify rules, sanitize order, or Features extractor.  
- Prefer extending `markdown-reader` props over forking Reader per surface.

### Git intelligence

Recent on `cursor/dashboard-epic-1-66a2`:

- `e517759` — story 3.1 Features extract  
- `0f95ac8` — realpath-contain catalog walk  
- `2df08a9` — story 2.4 honest empty / unreadable  
- `f07d9d2` — story 2.3 resolve-link  
- `d4646b9` — story 2.2 Reader  

Implement atop 3.1; first Reader routes outside `/docs/[...path]`.

### Latest tech information

- Stack unchanged: Svelte 5 runes, SvelteKit 2 loads, Bun, `bun:test`, Tailwind 4 tokens.  
- No new markdown libraries; status is line regex on file head already read for classify.  
- Route params `[id]` are plain string slugs (may contain `--`); no UUID package.  
- Section nav: `/epics` / `/stories` are **not** new nav items — only Overview / Features / Epics & Stories / Tests / Docs (UX-DR6).

### Testing requirements

Automated:

```bash
cd apps/dashboard
bun test src
bun run check
```

Cover at minimum: `status.test.ts`; resolve-link Kind→`/stories`/`/epics`; slug uniqueness regression; classify still excludes Feature Kind.

Manual (required evidence for done):

1. pocket-dimension Docs Epic → `/epics/…` Reader  
2. Docs Story with Status → `/stories/…` shows title + status; Story without Status still opens  
3. Bad slug → Unreadable; Features + health unchanged  
4. chhan-chhan: no invented Epic/Story rows  

### Project context reference

- App: `apps/dashboard`, port **3011**, standalone (no auth/DB)  
- BMAD trees: `pocket-dimension`, `zeo`, `chhan-chhan` under `_bmad-output/`  
- Dashboard tracking: `sprint-status-dashboard.yaml` only  

### References

- [Source: epics-dashboard.md — Epic 3 / Story 3.2]  
- [Source: prd-dashboard-2026-08-23/prd.md — FR-7, FR-8, UJ-1]  
- [Source: architecture-dashboard.md — `/epics/[id]`, `/stories/[id]`, slug, statusLabel, project tree]  
- [Source: ux-dashboard-2026-08-23/EXPERIENCE.md — Flow 1, UX-DR11, Kind names]  
- [Source: ux-dashboard-2026-08-23/DESIGN.md — status chip, Reader header]  
- [Source: apps/dashboard catalog/classify, slug, resolve-link, docs-catalog, markdown-reader, read-artifact, read-tree]  
- [Source: implementation-artifacts/3-1-browse-features-extracted-from-planning-artifacts.md — prior intelligence]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Added pure `status.ts` helpers (`extractStatusLine`, `mapStatusLabel`) with tests; status display-only from `Status:` line, never invented.
- Extended `ArtifactRef` with optional `status` / `statusLabel`; attached in `read-tree.ts` for epic/story kinds.
- Added `load-by-slug.ts` and `/epics/[id]` + `/stories/[id]` Reader routes reusing `MarkdownReader` + `loadArtifact`.
- Docs Catalog routes Epic/Story rows to slug URLs; shows muted status chip when present.
- `resolve-link` prefers `/epics|/stories` when target classifies as epic/story.
- All 99 tests pass; `bun run check` clean.

### File List

- apps/dashboard/src/lib/catalog/status.ts
- apps/dashboard/src/lib/catalog/status.test.ts
- apps/dashboard/src/lib/types.ts
- apps/dashboard/src/lib/server/read-tree.ts
- apps/dashboard/src/lib/server/load-by-slug.ts
- apps/dashboard/src/lib/server/load-by-slug.test.ts
- apps/dashboard/src/lib/server/read-artifact.ts
- apps/dashboard/src/lib/catalog/resolve-link.ts
- apps/dashboard/src/lib/catalog/resolve-link.test.ts
- apps/dashboard/src/lib/components/markdown-reader.svelte
- apps/dashboard/src/lib/components/docs-catalog.svelte
- apps/dashboard/src/routes/epics/[id]/+page.server.ts
- apps/dashboard/src/routes/epics/[id]/+page.svelte
- apps/dashboard/src/routes/stories/[id]/+page.server.ts
- apps/dashboard/src/routes/stories/[id]/+page.svelte
- _bmad-output/pocket-dimension/implementation-artifacts/sprint-status-dashboard.yaml
- _bmad-output/pocket-dimension/implementation-artifacts/3-2-open-epics-and-stories-with-optional-status.md

## Change Log

- 2026-08-23: Story 3.2 context created — Epic/Story Reader routes, optional Status display, no Delivery board.
- 2026-08-23: Story 3.2 implemented — slug routes, optional status, resolve-link Kind preference.

## Story Completion Status

Status: **done**
