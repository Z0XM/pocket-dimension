---
story_id: "2.2"
story_key: 2-2-read-an-artifact-as-structured-markdown
epic: 2
depends_on: 2-1-browse-docs-grouped-by-artifact-kind
baseline_commit: 683ea40
---

# Story 2.2: Read an Artifact as structured markdown

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->
<!-- Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Ubuntu,
I want to open any listed Artifact in the Reader,
so that I can read it as a document, not as a dumped file.

## Acceptance Criteria

1. **Given** I am in Docs with a listed Artifact (Story 2.1)  
   **When** I select it  
   **Then** that Artifact opens in the Reader without leaving dashboard (FR-3)  
   **And** the Catalog remains usable so I can open a sibling without starting over  
   **And** routes include `/docs` and `/docs/[...path]` with `?tree=`

2. **Given** a markdown Artifact  
   **When** the Reader presents it  
   **Then** it renders as structured document content (headings keep rank; lists, tables, emphasis, links visible as such), not only a `<pre>` dump (FR-4, UX-DR10)  
   **And** markdown is parsed and sanitized on the server (`remark-gfm` → rehype → `rehype-sanitize`, or marked + isomorphic-dompurify with the same contract) before `{@html}` (NFR-5)  
   **And** scripts, event handlers, and `javascript:` URLs are stripped  
   **And** Reader body uses Fira Code `{typography.body}`; title uses `{typography.display}`; max-width 48rem; Reader is the highest-contrast region (NFR-1, NFR-3: a multi-second wait on a normal Story is a defect)

3. **Given** a run folder (for example a PRD workspace)  
   **When** I open it  
   **Then** `prd.md` is the primary document when present  
   **And** otherwise the Reader lists sibling files so I can open them  
   **And** `markdown-reader` accepts only sanitized HTML + meta

## Tasks / Subtasks

- [x] Server markdown pipeline (AC: 2, NFR-5)
  - [x] **NEW** `apps/dashboard/src/lib/server/markdown.ts` — `sanitizeMarkdown(source: string): string` (HTML string)
  - [x] Preferred stack (architecture verified ~2026-08-23; npm current): `unified` + `remark-parse@^11` + `remark-gfm@^4` (4.0.1) → `remark-rehype` → `rehype-sanitize@^6` (6.0.0) → `rehype-stringify`
  - [x] Add deps under `apps/dashboard` `dependencies` (not root): at minimum `unified`, `remark-parse`, `remark-gfm`, `remark-rehype`, `rehype-sanitize`, `rehype-stringify`
  - [x] Fallback only if unified fails on Bun: `marked` + `isomorphic-dompurify` with **same contract** (strip scripts / handlers / `javascript:`). Prefer unified first
  - [x] Do **not** pass `allowDangerousHtml` through to stringify without sanitize after. If using `rehype-raw`, sanitize **must** be last transform before stringify
  - [x] Default `rehype-sanitize` schema is fine; safe `href`s remain visible (Story 2.3 owns `resolve-link` / unresolved marking — do **not** implement resolve-link here)
  - [x] Export a typed result shape if useful, e.g. `{ html: string }` — never return raw markdown to the client for `{@html}`

- [x] Golden sanitize tests (AC: 2)
  - [x] **NEW** `apps/dashboard/src/lib/server/markdown.test.ts`
  - [x] Fixtures (inline or under `src/lib/catalog/fixtures/` / `src/lib/server/fixtures/`): headings → `<h1>`…`<h6>` ranks preserved; GFM table → `<table>`; list → `<ul>`/`<ol>`; emphasis → `<em>`/`<strong>`; link with `https:` survives
  - [x] Hostile cases stripped / neutralized: `<script>`, `onclick=` / other event handlers, `javascript:` URLs — must not appear as executable in output
  - [x] Fail if output is only a raw dump with no heading structure for `# Title\n\npara`
  - [x] Run: `cd apps/dashboard && bun test src`

- [x] Resolve Artifact path under allow-list (AC: 1, 3, NFR-5)
  - [x] **NEW** helper in `apps/dashboard/src/lib/server/` (e.g. `read-artifact.ts` or functions on `read-tree.ts`): given `tree` + rest `path` (posix relative), resolve with `realpath` under `resolveTreePath(tree)` — reject `..`, symlink escape, paths outside tree (same discipline as `bmad-root.ts`)
  - [x] Return discriminated load DTO, roughly:
    ```ts
    type ArtifactPageData =
      | { kind: "markdown"; title: string; sourcePath: string; html: string }
      | { kind: "run-folder"; title: string; sourcePath: string; primary?: { title: string; sourcePath: string; html: string }; siblings: { title: string; sourcePath: string }[] }
      | { kind: "text"; title: string; sourcePath: string; text: string } // yaml/yml escaped — not {@html} raw
      | { kind: "error"; title?: string; sourcePath: string; reason: string };
    ```
  - [x] `.md` files → read full text → `sanitizeMarkdown` → `kind: "markdown"`
  - [x] `.yaml` / `.yml` → read as text, HTML-escape, present as plain text / `<pre>` via component (not remark); optional for catalog-open continuity — do not invent structured YAML UI
  - [x] Logging: `console.warn` with **relative** path only on skip/error; never log file bodies

- [x] Run-folder directory Artifacts (AC: 3, FR-4)
  - [x] **UPDATE** `read-tree.ts`: emit **directory** `ArtifactRef`s for run folders in addition to files
  - [x] v1 run-folder rule (path-first, no vibes): a directory is a run-folder Artifact when **either** (a) it directly contains `prd.md`, **or** (b) its path is under a `prds/` or `ux-designs/` segment and it contains ≥1 cataloguable child (`.md`/`.yaml`/`.yml`)
  - [x] `sourcePath` for directories: trailing-slash-free posix relative (e.g. `planning-artifacts/prds/prd-dashboard-2026-08-23`)
  - [x] Kind via existing `classifyArtifact` on a representative path (prefer `…/prd.md` or `…/DESIGN.md` if present, else directory path + `/`)
  - [x] Title: folder basename, or first `#` from primary `prd.md` / `DESIGN.md` when cheap
  - [x] Files inside the folder **remain** catalogued (2.1 behavior). Directory entry is additive — one Artifact per path still (file path ≠ folder path)
  - [x] When opening a **directory** path in Reader: if `prd.md` exists → sanitize + show as primary (`kind: "run-folder"` with `primary`); else → sibling list only (links to `/docs/{sibling}?tree=`)
  - [x] Sibling links must preserve `?tree=` and use same path encoding as Catalog

- [x] Routes: Catalog + Reader without dropping Catalog (AC: 1)
  - [x] **NEW** `apps/dashboard/src/routes/docs/[...path]/+page.server.ts` — load Artifact via resolver; require/keep `?tree=` (layout already resolves invalid tree → first allow-listed)
  - [x] **NEW** `apps/dashboard/src/routes/docs/[...path]/+page.svelte` — render Reader for loaded DTO
  - [x] **NEW or UPDATE** Docs shell so Catalog stays mounted on both `/docs` and `/docs/[...path]`:
    - Preferred: `docs/+layout.svelte` with Kind-grouped Catalog (left/inner rail) + `<slot />` / `{@render children()}` for Reader column
    - Move Catalog wiring out of `docs/+page.svelte` into that layout (or shared `docs-shell` component)
  - [x] `/docs` (no path): Catalog + empty/prompt Reader pane (“Select an Artifact.” or leave blank quietly — not Sample World; full empty polish is 2.4)
  - [x] **UPDATE** `docs-catalog.svelte`: change `rowHref` to `/docs/{encodePathSegments(sourcePath)}?tree={tree}` — **drop** Docs-local `?artifact=` seam (replace, do not keep both as source of truth)
  - [x] Active row: compare `item.sourcePath` to decoded `page.params.path` (normalize no leading `/`); hairline pattern unchanged (UX-DR4)
  - [x] Remove `preventDefault` + `history.replaceState` selection hack from 2.1 — use real navigation so `/docs/[...path]` loads
  - [x] Encode path segments with `encodeURIComponent` per segment; decode in server load. Do not use Windows `\` in URLs or DTOs

- [x] `markdown-reader` component (AC: 2, 3, UX-DR10, NFR-1)
  - [x] **NEW** `apps/dashboard/src/lib/components/markdown-reader.svelte`
  - [x] Props **only**: sanitized `html: string`, `title: string`, optional meta (`sourcePath`, Kind label) — **never** accept raw markdown
  - [x] Title: `text-display` / `{typography.display}`; body: Fira Code body ramp already on `body` / `text-body`
  - [x] Container: `max-w-[48rem]` (`{spacing.reader-max}`); highest-contrast region — `text-foreground` on page background; **no** tinted/carded Reader fill, no gradient, no second accent wash (DESIGN.md)
  - [x] Markdown chrome: headings keep rank; tables/lists use `border` token; inline code stays Fira Code. `@tailwindcss/typography` `prose` is OK if themed to DESIGN tokens (invert/prose-neutral carefully — do not introduce purple prose links as page theme)
  - [x] Render with `{@html html}` **only** after server sanitize
  - [x] Run-folder without primary: list sibling links (not cards); with primary: show primary HTML + optional sibling list below or aside — one job, quiet chrome

- [x] Minimal unreadable path (required for Reader to work; do not polish 2.4)
  - [x] Missing file / escape reject / read throw → `kind: "error"` with short reason; Catalog + shell still render
  - [x] Copy can be plain (“Unreadable Artifact.” + reason) — Story 2.4 owns EXPERIENCE polish and dogfood AC; do not expand empty-Kind UX here
  - [x] Do **not** fail the whole layout load when one Artifact fails

- [x] Preserve Epic 1–2.1 contracts (regression)
  - [x] Health `GET /health` → `{"status":"ok"}`; port **3011**; no auth/DB; no write APIs
  - [x] Closed allow-list + `bmad-root.ts` unchanged in behavior
  - [x] Layout still returns `{ trees, tree, bmadRootError, snapshot }` — do not add `searchCorpus` / `tests` yet
  - [x] `$lib/catalog` stays pure (no `fs`); markdown + path resolve stay in `$lib/server`
  - [x] Features / Delivery / Tests remain stubs
  - [x] Do **not** implement `resolve-link.ts`, unresolved link styling, heading scroll (2.3)
  - [x] Do **not** edit `apps/pocket/**`, rhymes `sprint-status.yaml`, non-dashboard epics/architecture
  - [x] Tracking file: only `sprint-status-dashboard.yaml`

- [x] Verify (AC: 1–3)
  - [x] `cd apps/dashboard && bun test src` — markdown sanitize goldens + existing classify/slug/bmad-root/nav still pass
  - [x] `cd apps/dashboard && bun run check`
  - [x] `bun run dev:app:dashboard` — from `/docs?tree=pocket-dimension` open an architecture/Story/PRD file → structured Reader (headings/lists/tables), Catalog still visible; click sibling → Reader updates; URL is `/docs/…?tree=`
  - [x] Open run folder `planning-artifacts/prds/prd-dashboard-2026-08-23` → `prd.md` primary; confirm a folder without `prd.md` lists siblings
  - [x] Hostile fixture / test proves script/`javascript:` stripped
  - [x] Reader max-width 48rem; display title; body Fira Code; contrast beats chrome
  - [x] `curl -sS http://localhost:3011/health` still OK

## Dev Notes

### Scope boundary (critical)

| In scope | Out of scope (later) |
| --- | --- |
| `markdown.ts` + remark-gfm → rehype-sanitize → `{@html}` | `resolve-link.ts` / unresolved destructive links / hash scroll (2.3) |
| `markdown-reader.svelte` (sanitized HTML + meta only) | Full empty/missing EXPERIENCE polish + FR-10 dogfood AC (2.4) — minimal error DTO OK |
| `/docs` + `/docs/[...path]?tree=` with Catalog kept mounted | `/epics/[id]`, `/stories/[id]` Reader reuse (Epic 3) |
| Run-folder directory Artifacts + `prd.md` primary / sibling list | Search overlay, `searchCorpus`, tests catalog (Epic 4) |
| Switch Catalog from `?artifact=` → real path routes | File watcher, MiniSearch, Sample World, write-back, auth |
| YAML open as escaped text (not remark) | Client-side markdown re-parse |

### Current UPDATE / NEW files (read before editing)

State after Story 2.1 (`baseline_commit` ≈ `683ea40`):

| File | Current state | This story changes | Must preserve |
| --- | --- | --- | --- |
| `src/lib/components/docs-catalog.svelte` | Rows → `/docs?tree=&artifact=`; `preventDefault` + `onSelect` | `href` → `/docs/{path}?tree=`; active from `params.path`; remove artifact query hack | Kind groups; accent hairline active; no violet fill |
| `src/routes/docs/+page.svelte` | Catalog only; `$state` + `?artifact=` | Becomes empty/prompt pane **or** Catalog moves to `docs/+layout.svelte` | Quiet type; no Sample World |
| `src/lib/server/read-tree.ts` | File-only walk `.md`/`.yaml`/`.yml` | Also emit run-folder **directory** ArtifactRefs | Selected-tree only; realpath; warn relative paths; no remark in walk |
| `src/lib/server/bmad-root.ts` | Allow-list + realpath | Prefer **untouched**; artifact resolver calls it | Walk-up root; three tree ids |
| `src/routes/+layout.server.ts` | `{ trees, tree, bmadRootError, snapshot }` | Prefer untouched (snapshot still drives Catalog) | No searchCorpus/tests yet |
| `src/lib/types.ts` | `ArtifactKind`, `ArtifactRef`, `TreeSnapshot` | Optional: small Reader DTO types if shared | No `'feature'` Kind |
| `src/app.css` | DESIGN tokens + Fira Code; typography plugin already imported | Optional Reader/prose token tweaks only | Hex brand layer; no purple wash |
| `src/lib/catalog/*` | classify / slug / group-by-kind | Prefer untouched; may classify dir paths | Pure — no `fs` |
| `package.json` | No remark/rehype yet | Add markdown sanitize deps | Port 3011 scripts; `bun test src` |

**NEW (required):**

| File | Role |
| --- | --- |
| `src/lib/server/markdown.ts` | `sanitizeMarkdown` — remark-gfm → rehype-sanitize |
| `src/lib/server/markdown.test.ts` | Structure + XSS goldens |
| `src/lib/server/read-artifact.ts` (name flexible) | Path resolve + file/dir load DTO |
| `src/lib/components/markdown-reader.svelte` | Sanitized HTML + title/meta only |
| `src/routes/docs/[...path]/+page.server.ts` | Load Artifact for path |
| `src/routes/docs/[...path]/+page.svelte` | Reader surface |
| `src/routes/docs/+layout.svelte` (recommended) | Catalog rail + children |

**Do not create yet:** `resolve-link.ts`, `search-overlay.svelte`, `keyboard.ts`, `features.ts`, `delivery.ts`, `tests-catalog.ts`, `/epics/[id]`, `/stories/[id]`, `/timeline`.

### Architecture compliance

- Shared read/sanitize on **server only**; one pipeline feeds Docs Reader (later Overview/Search reuse — do not fork a client parser) — [Source: architecture-dashboard.md — ADR + Data Flow]
- `$lib/server` = fs + realpath + sanitize; `$lib/catalog` = pure
- Routes: `/docs`, `/docs/[...path]`; query `tree` lowercase — [Source: architecture-dashboard.md — Frontend Architecture]
- `markdown-reader` accepts only sanitized HTML + meta — [Source: architecture-dashboard.md — Component Boundaries]
- Run folder: directory Artifact; `prd.md` primary else siblings — [Source: architecture-dashboard.md — Gap / FR-4]
- Security: realpath allow-list; never unsanitized `{@html}`; strip scripts/handlers/`javascript:` — [Source: NFR-5]
- Performance: normal Story open must feel immediate (multi-second = defect) — [Source: NFR-3]
- Named absences: Sample World, API nav, write-back, auth, watcher, MiniSearch

### Library / framework requirements

- Stack unchanged: Svelte 5 runes, SvelteKit 2 (`^2.49.1`), Bun (`bun --bun vite`), Tailwind 4, shadcn already present, `@fontsource/fira-code`
- **Add** (dashboard app): `remark-gfm@^4`, `rehype-sanitize@^6`, plus `unified`, `remark-parse`, `remark-rehype`, `rehype-stringify` (versions compatible with remark 15 / unified 11 line; verified remark-gfm 4.0.1, rehype-sanitize 6.0.0)
- **Do not** add MiniSearch, Drizzle, Better Auth, or a second markdown library alongside unified unless falling back
- Tests: `bun:test` co-located; keep `"test": "bun test src"`
- Prefer `$app/stores` `page` / `$app/state` consistency with existing nav for `params.path` + `tree`
- Build links with `URL` / `searchParams` so `tree` is never dropped

### Project Structure Notes

```
apps/dashboard/src/
  lib/
    types.ts                         # optional Reader DTO types
    catalog/                         # PRESERVE pure classify/slug/group
    server/
      bmad-root.ts                   # PRESERVE
      read-tree.ts                   # UPDATE — directory run-folder Artifacts
      markdown.ts                    # NEW
      markdown.test.ts               # NEW
      read-artifact.ts               # NEW — resolve + load
    components/
      docs-catalog.svelte            # UPDATE — path hrefs + active from route
      markdown-reader.svelte         # NEW
      section-nav.svelte             # PRESERVE (hairline reference)
  routes/
    docs/
      +layout.svelte                 # NEW recommended — Catalog + slot
      +page.svelte                   # UPDATE — prompt / empty Reader
      [...path]/+page.server.ts      # NEW
      [...path]/+page.svelte         # NEW
```

Conflict note: architecture Naming Patterns once listed `'feature'` in Kind — **ignore**; closure + 2.1 already removed it.

Conflict note: 2.1 Catalog used `?artifact=` without `[...path]` so routes would not 404. **This story replaces that seam** with real `/docs/[...path]` navigation. Leaving both will split active-state bugs — delete the artifact-query path.

Conflict note: SvelteKit `[...path]` param is a string with `/` separators (not an array). Decode carefully; empty path should not hit `[...path]` (that is `/docs`).

### Previous story intelligence (2.1)

- Catalog: `docs-catalog.svelte` + `groupArtifactsByKind`; active = `border-l-2 border-accent bg-card` (mirrors `section-nav`)
- Snapshot: `loadTreeSnapshot` in layout; selected Tree only; files `.md`/`.yaml`/`.yml`; title from first `#` or basename
- Explicit comment in catalog: “Story 2.2 attaches Reader at `/docs/[...path]`…” — honor that plan
- Seam today: `?artifact=` + `preventDefault` — **replace** with path routes
- 2.1 deferred run-folder directory Artifacts and all remark/sanitize — own them here
- Tests: 31 passing after 2.1 (`classify`, `slug`, `bmad-root`, `nav`); keep them green
- Tracking: `sprint-status-dashboard.yaml` only — never rhymes `sprint-status.yaml`
- Dogfood paths under `pocket-dimension`: `planning-artifacts/prds/prd-dashboard-2026-08-23/prd.md`, `…/architecture-dashboard.md`, `implementation-artifacts/2-1-….md`, UX `DESIGN.md`

### Git intelligence

Recent commits on `cursor/dashboard-epic-1-66a2`:

- `683ea40` — story 2.1 Docs Kind-grouped Catalog + classify + read-tree + `?artifact=` seam
- `ed7442d` — story 1.4 Overview + section nav + stub routes
- `ca51c29` — story 1.3 allow-list trees + switcher + layout load
- `fcc8d37` — story 1.2 quiet dark chrome
- `630dce2` / `b5f43bb` — planning + story 1.1 scaffold

Implement atop 2.1; do not re-scaffold Catalog, re-token chrome, or reopen allow-list design.

### Latest tech information

- Pipeline (safe): `remark-parse` → `remark-gfm` → `remark-rehype` → `rehype-sanitize` → `rehype-stringify`. Sanitize **after** any raw-HTML admission
- `rehype-sanitize@6` default schema matches github-ish allow-list; strips scripts and dangerous URLs — assert in tests rather than trusting defaults blindly
- Packages are ESM-only; dashboard already `"type": "module"` — fine with Bun
- `@tailwindcss/typography` is already `@plugin` in `app.css` — use for Reader if token-aligned; avoid default `prose-purple`
- NFR-3: sanitize is sync/async-ok in `load`; do not ship client-side unified for v1 body render

### Testing requirements

Automated:

```bash
cd apps/dashboard
bun test src          # markdown XSS/structure goldens; classify/slug/bmad-root/nav still pass
bun run check         # types clean with docs layout + [...path] loads
```

Manual:

```bash
bun run dev:app:dashboard
# /docs?tree=pocket-dimension → Catalog
# Click architecture-dashboard.md → URL /docs/planning-artifacts/architecture-dashboard.md?tree=pocket-dimension
# Reader: headings/lists/tables; Catalog still visible; click a Story sibling → Reader swaps
# Open run folder …/prds/prd-dashboard-2026-08-23 → prd.md primary content
# Optional: folder without prd.md → sibling list links work
curl -sS http://localhost:3011/health   # {"status":"ok"}
```

Fail if: `{@html}` of unsanitized markdown; Catalog unmounts on open; `?artifact=` remains source of truth; resolve-link implemented “while here”; Reader on tinted card background; filled violet active rows; `fs` in `$lib/catalog`; Sample World; health/port/auth regressions; rhymes `sprint-status.yaml` edited.

### Anti-patterns (do not)

- `{@html}` raw markdown or client-only marked without sanitize
- Implementing `resolve-link.ts` / unresolved link CSS in this story (keep hrefs visible post-sanitize only)
- Dropping Catalog into a single-doc full-page view with no sibling list
- Keeping `?artifact=` as parallel selection state
- Putting remark/fs in `$lib/catalog`
- Tinted / gradient / carded Reader background; neon violet; second display font
- Filled `bg-accent` Catalog active blocks
- Logging full markdown bodies
- File watcher or caching snapshot/HTML in `localStorage`
- Editing rhymes `sprint-status.yaml` or non-dashboard planning trees
- Expanding Story 2.4 empty-state matrix beyond minimal unreadable DTO
- Treating HTML mockups under `ux-designs/mockups/` as markdown Artifacts (still skip non-md/yaml)

### Empty / error / loading copy (minimal — 2.4 polishes)

| State | Copy |
| --- | --- |
| `/docs` no selection | Quiet prompt or empty Reader pane (e.g. “Select an Artifact.”) — not marketing |
| Unreadable / missing path | “Unreadable Artifact.” + short reason; Catalog stays |
| Run folder without `prd.md` | Sibling file list (links), not a fake document |
| Docs zero files | Keep “No Docs in this Tree.” (2.1) |
| BMAD Root missing | Shell: “BMAD Root unavailable.” (1.3) |

Do **not**: “Oops!”, Sample World, “War Room”, “quests”.

### References

- [Source: planning-artifacts/epics-dashboard.md — Story 2.2, Epic 2, FR-3, FR-4, NFR-1, NFR-3, NFR-5, UX-DR10]
- [Source: planning-artifacts/architecture-dashboard.md — markdown.ts, markdown-reader, docs/[...path], sanitize pipeline, run-folder gap, component boundaries]
- [Source: planning-artifacts/ux-designs/ux-dashboard-2026-08-23/DESIGN.md — reader-max 48rem; display/body; Catalog hairline; Reader markdown rules]
- [Source: planning-artifacts/ux-designs/ux-dashboard-2026-08-23/EXPERIENCE.md — Docs rail + Reader; Flow 2 structured markdown climax]
- [Source: planning-artifacts/prds/prd-dashboard-2026-08-23/prd.md — FR-3 Open Artifact; FR-4 Present content; Reader definition]
- [Source: planning-artifacts/prds/prd-dashboard-2026-08-23/addendum.md — Docs + Reader from SIS; Sample World excluded]
- [Source: implementation-artifacts/2-1-browse-docs-grouped-by-artifact-kind.md — Catalog + `?artifact=` seam; deferred Reader/run-folder]
- [Source: apps/dashboard/src/lib/components/docs-catalog.svelte — UPDATE baseline]
- [Source: apps/dashboard/src/routes/docs/+page.svelte — UPDATE baseline]
- [Source: apps/dashboard/src/lib/server/read-tree.ts — UPDATE baseline]
- [Source: apps/dashboard/src/lib/server/bmad-root.ts — allow-list API]
- [Source: apps/dashboard/package.json — add remark/rehype deps]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Implemented server-side markdown pipeline (`remark-gfm` → `rehype-sanitize`) with 7 golden XSS/structure tests.
- Added `read-artifact.ts` for allow-list path resolution and discriminated load DTOs (markdown, run-folder, text, error).
- Updated `read-tree.ts` to emit run-folder directory Artifacts (prd.md or prds/ux-designs segments).
- Replaced 2.1 `?artifact=` seam with `/docs/[...path]?tree=` routes; Catalog stays mounted via `docs/+layout.svelte`.
- Added `markdown-reader.svelte` (sanitized HTML only, 48rem max-width, prose-invert).
- 38 tests pass; `bun run check` clean; health endpoint OK; manual curl verified structured `<h1>`/`<h2>` rendering.

### File List

- `apps/dashboard/package.json`
- `apps/dashboard/src/lib/docs-path.ts`
- `apps/dashboard/src/lib/types.ts`
- `apps/dashboard/src/lib/server/markdown.ts`
- `apps/dashboard/src/lib/server/markdown.test.ts`
- `apps/dashboard/src/lib/server/read-artifact.ts`
- `apps/dashboard/src/lib/server/read-tree.ts`
- `apps/dashboard/src/lib/components/docs-catalog.svelte`
- `apps/dashboard/src/lib/components/markdown-reader.svelte`
- `apps/dashboard/src/routes/docs/+layout.svelte`
- `apps/dashboard/src/routes/docs/+page.svelte`
- `apps/dashboard/src/routes/docs/[...path]/+page.server.ts`
- `apps/dashboard/src/routes/docs/[...path]/+page.svelte`
- `_bmad-output/pocket-dimension/implementation-artifacts/2-2-read-an-artifact-as-structured-markdown.md`
- `_bmad-output/pocket-dimension/implementation-artifacts/sprint-status-dashboard.yaml`

## Change Log

- 2026-08-23: Story 2.2 context created (ready-for-dev) — Docs Reader via `/docs/[...path]`, server sanitize pipeline, run-folder primary `prd.md`, Catalog kept mounted.
- 2026-08-23: Story 2.2 implemented — structured markdown Reader, path routes, run-folder support, sanitize tests (38 passing).
