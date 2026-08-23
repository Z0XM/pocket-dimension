---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - planning-artifacts/prds/prd-dashboard-2026-08-23/prd.md
  - planning-artifacts/prds/prd-dashboard-2026-08-23/addendum.md
  - planning-artifacts/architecture-dashboard.md
  - planning-artifacts/ux-designs/ux-dashboard-2026-08-23/DESIGN.md
  - planning-artifacts/ux-designs/ux-dashboard-2026-08-23/EXPERIENCE.md
outputFile: planning-artifacts/epics-dashboard.md
note: Separate from planning-artifacts/epics.md (rhymes). Do not overwrite that file.
---

# dashboard - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for dashboard, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR-1: Discover BMAD Trees — Ubuntu can see every Current BMAD Tree. The Catalog lists each Current BMAD Tree at read time. A leftover or stale first-level folder under the BMAD Root does not appear. Adding or removing a Current BMAD Tree is reflected the next time the Catalog is loaded. v1 reloads on navigation or page load; live file watching is not required.

FR-2: Browse by Artifact Kind — Ubuntu can browse Artifacts in a BMAD Tree grouped by Artifact Kind. Epic, Story, documentation, and other classified Kinds each have a Catalog entry when at least one Artifact of that Kind exists. An Artifact appears in exactly one primary Kind grouping. If classification is ambiguous, the Artifact still appears once, under the best Kind or under unclassified.

FR-3: Open an Artifact from the Catalog — Ubuntu can open any listed Artifact into the Reader without leaving dashboard. The Catalog remains usable so Ubuntu can move to a sibling Artifact without starting over.

FR-4: Present Artifact content — Ubuntu can read the selected Artifact in the Reader. A markdown Artifact renders as structured document content, not only as a raw source dump. A run folder exposes its primary document and lists sibling files; `prd.md` is the primary document when present, otherwise the Reader lists folder contents.

FR-5: Follow in-document links — Ubuntu can follow links from one Artifact to another Artifact or to a heading when the target is inside the BMAD Root. A relative link to another BMAD file opens that Artifact in the Reader. A link the Showcase cannot resolve is still visible and is marked as unresolved rather than failing silently.

FR-6: Empty, missing, and parse-failure states — An empty BMAD Tree or Kind shows an empty state, not a blank page. A missing or unreadable Artifact shows an error in the Reader; the rest of the Catalog still works.

FR-7: Epic Showcase — Epic Artifacts are listed as Artifact Kind Epic. From an Epic view, referenced Stories that exist as Artifacts are openable. v1 uses links and filenames already in the Epic document; it does not require a separate story-index schema.

FR-8: Story Showcase — Story Artifacts are listed as Artifact Kind Story. Status and title are visible in the Catalog or Reader header when present in the file (for example a Status line). Stories without status still list and open.

FR-9: Feature and FR visibility — Opening a PRD (or equivalent planning Artifact) makes Feature headings and FR identifiers readable in the Reader. The Features surface (FR-13) lists those same Features; it does not invent Features that are not in planning Artifacts.

FR-10: Dogfood dashboard Artifacts — This PRD and subsequent dashboard UX, architecture, Epic, and Story Artifacts appear in the relevant BMAD Tree once they exist on disk. dashboard does not special-case itself beyond being Artifacts in the BMAD record.

FR-11: Quiet professional presentation — Background is black or a shade of black; accent is a purple or violet shade; body type is Fira Code. Chrome stays visually quieter than the Reader content. Desktop-first; a dedicated mobile layout is out of scope.

FR-12: Search Artifact content — Ubuntu can run a full-text Search and open a hit as an Artifact. A query matches text inside Artifact content, not titles alone. Each hit names the Artifact, its Artifact Kind, and its BMAD Tree, and shows enough surrounding text to judge. Opening a hit shows that Artifact in the Reader. No matches shows an empty Search state. Search does not include leftover or stale trees. Matching is case-insensitive substring or simple token match; no query language. Search runs across all Current BMAD Trees and can narrow to the Tree in view. Binary or non-text files are skipped. Out of scope: query operators, saved searches, ranking tuning.

FR-13: List Features from planning Artifacts — Features that appear in PRDs (or equivalent planning Artifacts) appear on the Features surface. Selecting a Feature opens that Artifact in the Reader. A Tree with no Feature/FR sections shows an empty Features state.

FR-14: Delivery board of Epics and Stories — Delivery lists Epics and their Stories when those Artifacts exist. Status is shown when present in Story conventions or `sprint-status.yaml`. Selecting an Epic or Story opens that Artifact. Board and table are both required.

FR-15: Process Timeline — Timeline shows Epics in document or process order with Stories under them (not a calendar). A Story or Epic on the Timeline is openable. Missing sprint-status does not hide Epics or Stories that exist as files.

FR-16: Catalog existing tests — Tests that exist on disk appear on the Tests surface. An empty catalog shows an empty Tests state. The Tests surface does not seed or display Sample World or sample-data fixtures. v1 does not require in-dashboard test execution.

FR-17: Overview of the selected Tree — Overview names the selected Tree and does not include leftover Trees. Overview links to Features, Delivery, Tests, and Docs. App open lands here.

### NonFunctional Requirements

NFR-1: Clarity — Reader content remains the highest-contrast, most readable region of the page.

NFR-2: Honesty — Parse and link failures are visible. The Showcase does not invent Artifacts that are not on disk and does not present leftover or stale BMAD trees. No Sample World fallback corpus.

NFR-3: Performance — Opening a typical Artifact (single markdown file) feels immediate on a local machine. A multi-second wait on a normal Story is a defect. No hard numeric budget.

NFR-4: Accessibility — Keyboard can complete UJ-1–UJ-7 (Catalog into Reader, Search, Delivery views). Rendered markdown keeps heading ranks. WCAG AA is a target, not a formal audit gate for v1. Contrast and focus on black are load-bearing.

NFR-5: Security — v1 is local/internal. The Reader does not execute untrusted scripts from markdown. Server-side sanitize before `{@html}`. Filesystem allow-list with realpath; reject path traversal and symlink escape. No auth-service, sessions, or sharing links.

NFR-6: Freshness — Catalog refreshes on navigation or page load. No file watcher. Features / Docs / Search must not diverge (one request-time snapshot).

NFR-7: Read-only data — Source of truth is BMAD files on disk. No product database. No write-back of Story status or file edits, including “just for local.”

### Additional Requirements

**STARTER TEMPLATE (Epic 1 Story 1 — required):** Copy `apps/pocket` → `apps/dashboard`, rename package `@pocket-dimension/dashboard`, strip pocket hub catalog, copy shadcn wiring from `apps/watchlist` (`components.json`, `$lib/utils`, ui primitives as needed), add root Turbo filters `build:app:dashboard` and `dev:app:dashboard`, default port **3011**. Fallback only if copy is blocked: `bunx sv create apps/dashboard --template minimal --types ts --no-add-ons --no-install`, then immediately align with pocket/watchlist (adapter-bun, Tailwind 4 Vite, shadcn-svelte). First implementation story is this sibling copy, not invent-a-scaffold.

- Stack: TypeScript, Svelte 5, SvelteKit 2, Bun (`bun --bun vite`), `svelte-adapter-bun`, Tailwind 4, shadcn-svelte 1.5.x / bits-ui. Svelte 5 runes for UI state; no extra store library.
- No PostgreSQL, no Drizzle, no Better Auth, no `shared/dashboard` package. Parsers stay in the app.
- Closed allow-list roots: `_bmad-output/{pocket-dimension,zeo,chhan-chhan}/` from `_bmad-output/README.md` (not a glob of leftover trees) plus test globs under `apps/**`. `bmad-root.ts` walks up from `import.meta.dir` / cwd until `_bmad-output/` exists.
- Markdown pipeline on the server: `remark-gfm@^4` → rehype → `rehype-sanitize@^6` before `{@html}`. Fallback: marked + isomorphic-dompurify with the same contract. Never unsanitized `{@html}`.
- One Delivery dataset; board / table / timeline are three views. Default view: **board**. Status precedence: (1) `sprint-status.yaml` if parseable, (2) Story file `Status:` line, (3) unknown. Never invent status. Code union: `'backlog' | 'in-progress' | 'done' | 'unknown'` plus `statusLabel` for the raw string.
- Dual-nav truth in the URL: `tree` (`pocket-dimension` | `zeo` | `chhan-chhan`) and Delivery `view` (`board` | `table` | `timeline`). Invalid tree → first allow-listed tree. `/timeline` redirects to `/delivery?view=timeline`. Refresh restores both.
- Routes: `/` Overview, `/features`, `/delivery`, `/tests`, `/docs`, `/docs/[...path]`, `/epics/[id]`, `/stories/[id]`. `[id]` is a slug from path/filename, unique per tree; epic/story routes require `?tree=`.
- Layout load payload: `{ trees, tree, snapshot, searchCorpus, tests }`. `snapshot` = selected Tree. `searchCorpus` = all Current BMAD Trees. Search defaults to all trees; can narrow to `tree`. Search is in-memory substring/token over the load payload; no MiniSearch in v1.
- Tests catalog scans `apps/**` for `*.test.ts` / `*.spec.ts` (and equivalent). Never scans `_bmad-output`. Tree filter prefixes: `zeo` → `apps/zeo`, `chhan-chhan` → `apps/chhan-chhan`, `pocket-dimension` → no prefix (full catalog).
- Feature is a surface/extraction, not an `ArtifactKind`. `ArtifactKind`: `'epic' | 'story' | 'doc' | 'prd' | 'ux' | 'architecture' | 'unclassified'`. Unclassified appear in Docs; omitted from Delivery and Features.
- `resolve-link.ts`: relative href + source path → in-root Reader URL or `{ unresolved: true }`. Applied after sanitize.
- `$lib/server` = fs + realpath only. `$lib/catalog` = pure parsers (no fs). Display-only: no POST/PATCH/DELETE for product data.
- Keyboard: one registry. `⌘K` / `Ctrl+K` and `/` open Search. Esc closes. Restore focus. `/` does not steal when focus is in an editable field.
- Logging: server parse/skip at warn with relative path; do not log full file contents. Health check may exist (pocket pattern) and must not dump files.
- Deploy Dockerfile/Railpack deferred; v1 success does not require deploy. No public REST API. No API-docs nav.
- Named absences (do not implement): Blockers, Questions, Deferred, test runner, API docs, Pocket hub tile, Sample World, file watcher, MiniSearch, configurable BMAD Root UI, multi-tenant hosting.
- Implementation sequence hint (must be wrapped in user-value stories, not used as epic titles): scaffold → allow-list → markdown pipeline → classifier → Delivery projection → Features/Docs/Tests/Search → dual-nav + keyboard + chrome.
- Parser golden fixtures live with the app (`src/lib/catalog/fixtures/`), not in BMAD files. Co-located `*.test.ts`. `bun test src` like zeo.
- Naming: kebab-case Svelte files; query keys `tree`, `view`; EXPERIENCE.md copy for empty/error/search-miss.

### UX Design Requirements

UX-DR1: Implement DESIGN.md brand tokens in `src/app.css` and shadcn mapping: background `#0A0A0A`, surface `#111111`, foreground `#F5F5F5`, muted `#A3A3A3`, border `#262626`, accent `#8B5CF6`, accent-foreground `#FAFAFA`, destructive `#F87171`. `primary` = accent. No neon violet, no gradients, no colored Reader background, no second accent family.

UX-DR2: Use Fira Code for chrome and Reader (`@fontsource/fira-code`, not pocket Nunito). Body 14px/400/1.6; label 12px/500/1.4; display 20px/500/1.3. No second display face. No serif “literary” moment.

UX-DR3: Desktop-first layout: left rail ~280px (Tree switcher + section nav), page gutter 16px, Reader max-width 48rem as the widest, brightest-contrast region. Elevation is tonal + hairline only; no glass; Search may use shadcn popover/dialog shadow. Radius: sm 4px rows/inputs, md 6px buttons/Search, lg 8px dialogs. Status chip is the only pill.

UX-DR4: Catalog/Search active row: surface fill + accent left hairline, not a filled violet block. Search match span uses accent underline or color, not a highlight wash. Unresolved links use destructive and still look like links. Empty/error: one display line + one body reason; no illustrations.

UX-DR5: Tree switcher in sidebar brand lists Current BMAD Trees only and changes Overview/Features/Delivery/Tests/Docs context.

UX-DR6: Section nav lists only Overview, Features, Epics & Stories, Tests, Docs. No Data/Sample World. No dead nav items for API, Blockers, Questions, Deferred.

UX-DR7: Overview is the app-open landing: selected Tree name, counts, and links to Features, Delivery, Tests, Docs.

UX-DR8: Features surface uses a Feature row showing Feature/FR id, name, and source Artifact; click opens Reader on that Artifact; text filter on the list.

UX-DR9: Delivery shares one route with view chips Board / Table / Timeline (default board). Board columns from Story status when present (backlog → done); cards open Story/Epic; group by Epic or Story. Table is the same data tabular. Timeline is a vertical process-ordered rail (Epic milestones, Stories as nodes); status color is semantic, not decorative.

UX-DR10: Docs surface is Kind-grouped Catalog + markdown Reader (headings keep rank; tables and lists use border token; inline code stays Fira Code). Unclassified files appear here.

UX-DR11: Epic and Story detail use the Reader, reached from Delivery, Timeline, or Search, with a way back via Delivery.

UX-DR12: Search is a command overlay (not a card grid) opened by ⌘K / Ctrl+K, `/`, or a header button. Groups: Feature, Epic, Story, Test, Docs. Enter opens the highlighted hit. Esc closes. Arrow keys highlight. Type chips optional. `aria-live` on results. Copy: “No matches for {query}.”

UX-DR13: Tests surface is a Test row (path or name); open source when a path exists; no Run button in v1. Empty copy: “No tests found.” Never invent Sample World cases.

UX-DR14: State copy (literal): cold load “Reading BMAD…” or skeletons; empty Features/Delivery/Tests “No Features in this Tree.” (etc.); missing Artifact “Unreadable Artifact.” + reason. Voice is short and literal: no “Oops”, no marketing, no “War Room” / “quests”.

UX-DR15: Interaction bans in v1: hover-only actions, drag-to-change-status, Sample World actions, API tab, modal stacks deeper than Search.

UX-DR16: Keyboard can complete UJ-1–UJ-7 without a mouse. Focus ring is accent on background. Below ~1024px / `< lg` the sidebar becomes a sheet (usable, not a phone product).

UX-DR17: shadcn components to add/use: button, dialog, command, input, scroll-area, separator, badge, table, tabs, sheet — inherit anatomy; do not invent a second component language. Product components named in architecture: `app-shell`, `tree-switcher`, `section-nav`, `search-overlay`, `markdown-reader`, `feature-row`, `delivery-board`, `delivery-table`, `delivery-timeline`, `test-row`.

### FR Coverage Map

FR-1: Epic 1 - Discover Current BMAD Trees in the Tree switcher; leftovers excluded.
FR-2: Epic 2 - Browse Artifacts grouped by Artifact Kind in Docs.
FR-3: Epic 2 - Open a listed Artifact into the Reader without leaving dashboard.
FR-4: Epic 2 - Present markdown as structured content; run-folder primary `prd.md` or sibling list.
FR-5: Epic 2 - Follow in-BMAD-Root links; mark unresolved links instead of failing silently.
FR-6: Epic 2 - Empty Tree/Kind and missing/unreadable Artifact states.
FR-7: Epic 3 - List Epics and open referenced Stories from an Epic view.
FR-8: Epic 3 - List Stories; show title and optional status; open in Reader.
FR-9: Epic 3 - Feature headings and FR identifiers visible; Features surface lists the same Features.
FR-10: Epic 2 - dashboard’s own BMAD Artifacts appear in the pocket-dimension Tree like any other Artifact.
FR-11: Epic 1 - Quiet dark chrome, violet accent, Fira Code, desktop-first.
FR-12: Epic 4 - Full-text Search across Current BMAD Trees with snippets and open-in-Reader.
FR-13: Epic 3 - Features catalog extracted from planning Artifacts; empty state if none.
FR-14: Epic 3 - Delivery board and table of Epics and Stories; read-only status.
FR-15: Epic 3 - Process Timeline as a third view of the same Delivery dataset.
FR-16: Epic 4 - Catalog tests under `apps/**`; no runner; no Sample World.
FR-17: Epic 1 - Overview landing for the selected Tree with links to Features, Delivery, Tests, Docs.

## Epic List

### Epic 1: Open a current Tree and see where work stands
Ubuntu can run dashboard locally, pick a Current BMAD Tree, and land on Overview with counts and links. Leftover trees stay hidden. Chrome is quiet, dark, and typed in Fira Code.
**FRs covered:** FR-1, FR-11, FR-17

### Epic 2: Read any Artifact as a Showcase page
Ubuntu can browse by Artifact Kind, open a document in the Reader, follow in-root links, and get honest empty or missing states. dashboard’s own BMAD files show up like everything else.
**FRs covered:** FR-2, FR-3, FR-4, FR-5, FR-6, FR-10

### Epic 3: See Features and walk Epics & Stories
Ubuntu can browse Features extracted from planning Artifacts, open the defining document, and use Delivery (board, table, Timeline) to open Epics and Stories. Status is read-only.
**FRs covered:** FR-7, FR-8, FR-9, FR-13, FR-14, FR-15

### Epic 4: Find a phrase and see which tests exist
Ubuntu can Search across Current BMAD Trees and open a hit, and can catalog real tests on disk with no runner and no Sample World.
**FRs covered:** FR-12, FR-16

## Epic 1: Open a current Tree and see where work stands

Ubuntu can run dashboard locally, pick a Current BMAD Tree, and land on Overview with counts and links. Leftover trees stay hidden. Chrome is quiet, dark, and typed in Fira Code.

### Story 1.1: Run dashboard from the pocket sibling starter

As Ubuntu,
I want a local `dashboard` app I can start from the monorepo,
So that I have a place to open the BMAD Showcase in the browser.

**Acceptance Criteria:**

**Given** the monorepo has `apps/pocket` and watchlist shadcn wiring
**When** this story is implemented
**Then** `apps/dashboard` exists as package `@pocket-dimension/dashboard` copied from `apps/pocket`
**And** the pocket hub catalog is stripped so the app is not a second Pocket
**And** shadcn/`components.json` wiring is copied from `apps/watchlist` as needed
**And** root scripts `dev:app:dashboard` and `build:app:dashboard` exist
**And** `bun run dev:app:dashboard` serves on port **3011** with no auth-service and no PostgreSQL
**And** if the pocket copy is blocked, the fallback is `sv create` then immediate align with pocket/watchlist (adapter-bun, Tailwind 4, shadcn-svelte)

**Given** the app is running
**When** I open `http://localhost:3011`
**Then** I see a SvelteKit page for dashboard (not the Pocket hub tile grid)
**And** there is no write API and no database config required

### Story 1.2: Show quiet dark chrome that does not compete with content

As Ubuntu,
I want the Showcase to look like a finished dark internal tool,
So that chrome stays out of the way when I later read Artifacts.

**Acceptance Criteria:**

**Given** Story 1.1’s app is running
**When** I open any dashboard page
**Then** page background is DESIGN.md `{colors.background}` (`#0A0A0A`) and raised chrome uses `{colors.surface}` (`#111111`)
**And** the only brand accent is `{colors.accent}` (`#8B5CF6`), used for focus/selection, not as a sidebar or page fill
**And** body, labels, and titles are Fira Code at the DESIGN.md type ramp (no second typeface, not pocket Nunito)
**And** `src/app.css` holds these tokens and maps shadcn `primary` to accent
**And** chrome (nav, headers) is visually quieter than the main column (NFR-1, FR-11)

**Given** a desktop viewport `≥ lg`
**When** I view the shell
**Then** a left rail (~280px) sits beside a main column with 16px gutter
**And** below `lg` the rail becomes a sheet (usable, not a phone product)
**And** elevation is tonal + hairline (`{colors.border}`); no glass, no War Room grain, no gradients

**Given** keyboard focus
**When** I tab through chrome
**Then** the focus ring is accent on the dark background
**And** there are no hover-only actions

### Story 1.3: Switch among Current BMAD Trees only

As Ubuntu,
I want to pick `pocket-dimension`, `zeo`, or `chhan-chhan`,
So that I only see living BMAD Trees, not leftover folders.

**Acceptance Criteria:**

**Given** `_bmad-output/README.md` names Current BMAD Trees (`pocket-dimension`, `zeo`, `chhan-chhan`)
**When** the shell loads
**Then** the Tree switcher lists exactly those trees that exist on disk at read time (FR-1, UX-DR5)
**And** a leftover first-level folder under `_bmad-output/` does not appear
**And** `bmad-root.ts` finds the repo by walking up from `import.meta.dir` / cwd until `_bmad-output/` exists
**And** paths are `realpath`-resolved; anything outside the allow-list is not served

**Given** I select a tree in the switcher
**When** the URL updates
**Then** `?tree=` is one of `pocket-dimension` | `zeo` | `chhan-chhan`
**And** a refresh restores that tree
**And** an invalid or missing `tree` value falls back to the first allow-listed tree, not a leftover folder

**Given** I add or remove a Current BMAD Tree on disk
**When** I navigate or reload
**Then** the switcher reflects the new set (no file watcher)

**Given** `_bmad-output` is missing or unreadable
**When** I open dashboard
**Then** I see an honest empty/error state, not Sample World data

### Story 1.4: Land on Overview for the selected Tree

As Ubuntu,
I want to open dashboard on a thin Overview of the selected Tree,
So that I can jump to Features, Delivery, Tests, or Docs without hunting folders.

**Acceptance Criteria:**

**Given** a Current BMAD Tree is selected (Story 1.3)
**When** I open `/`
**Then** Overview names that Tree and does not list leftover Trees (FR-17, UX-DR7)
**And** Overview links to Features, Delivery, Tests, and Docs
**And** a short cold load (“Reading BMAD…” or skeletons) may appear; no global spinner that blocks chrome (UX-DR14)

**Given** the sidebar
**When** I look at section nav
**Then** the only items are Overview, Features, Epics & Stories, Tests, Docs (UX-DR6)
**And** there are no nav items for Data, Sample World, API, Blockers, Questions, or Deferred
**And** the active item uses an accent left hairline, not a filled violet block
**And** those routes exist so the links do not 404; pages that Epic 2–4 will fill may show the matching empty copy (e.g. “No Features in this Tree.”)

**Given** I switch Tree
**When** Overview reloads
**Then** the name and links are for the new Tree
**And** counts, if shown, are from disk for this Tree only (not leftover trees, not Sample World). Kind-accurate Feature/Epic/Test counts may stay 0 until later epics classify Artifacts

## Epic 2: Read any Artifact as a Showcase page

Ubuntu can browse by Artifact Kind, open a document in the Reader, follow in-root links, and get honest empty or missing states. dashboard’s own BMAD files show up like everything else.

### Story 2.1: Browse Docs grouped by Artifact Kind

As Ubuntu,
I want Artifacts in the selected Tree grouped by Kind,
So that I can find Epics, Stories, docs, and planning packs without knowing the path.

**Acceptance Criteria:**

**Given** a Current BMAD Tree is selected
**When** I open Docs
**Then** Artifacts are grouped by Artifact Kind: at least Epic, Story, documentation, and other classified Kinds when at least one of that Kind exists (FR-2, UX-DR10)
**And** classification uses path/filename first, heuristics second; unknown → `unclassified`
**And** `ArtifactKind` is `'epic' | 'story' | 'doc' | 'prd' | 'ux' | 'architecture' | 'unclassified'` — Feature is not a Kind
**And** an Artifact appears in exactly one primary Kind; unclassified files appear in Docs, not as invented Features or Delivery rows
**And** parsers live in `$lib/catalog` (pure); `fs` / `realpath` only in `$lib/server`
**And** the per-navigation `snapshot` is the selected Tree only (NFR-6)

**Given** I am in Docs
**When** I move among Kind groups
**Then** the Catalog stays usable (list remains) so I can pick another Artifact without starting over
**And** the active Catalog row uses surface fill + accent left hairline, not a filled violet block (UX-DR4)

**Given** a Tree with only unclassified files
**When** I open Docs
**Then** those files still appear once under unclassified
**And** nothing is hidden just because Kind is unknown

### Story 2.2: Read an Artifact as structured markdown

As Ubuntu,
I want to open any listed Artifact in the Reader,
So that I can read it as a document, not as a dumped file.

**Acceptance Criteria:**

**Given** I am in Docs with a listed Artifact (Story 2.1)
**When** I select it
**Then** that Artifact opens in the Reader without leaving dashboard (FR-3)
**And** the Catalog remains usable so I can open a sibling without starting over
**And** routes include `/docs` and `/docs/[...path]` with `?tree=`

**Given** a markdown Artifact
**When** the Reader presents it
**Then** it renders as structured document content (headings keep rank; lists, tables, emphasis, links visible as such), not only a `<pre>` dump (FR-4, UX-DR10)
**And** markdown is parsed and sanitized on the server (`remark-gfm` → rehype → `rehype-sanitize`, or marked + isomorphic-dompurify with the same contract) before `{@html}` (NFR-5)
**And** scripts, event handlers, and `javascript:` URLs are stripped
**And** Reader body uses Fira Code `{typography.body}`; title uses `{typography.display}`; max-width 48rem; Reader is the highest-contrast region (NFR-1, NFR-3: a multi-second wait on a normal Story is a defect)

**Given** a run folder (for example a PRD workspace)
**When** I open it
**Then** `prd.md` is the primary document when present
**And** otherwise the Reader lists sibling files so I can open them
**And** `markdown-reader` accepts only sanitized HTML + meta

### Story 2.3: Follow in-root links and mark unresolved ones

As Ubuntu,
I want links inside an Artifact to open the target or show that they cannot,
So that I can move through the BMAD record without silent failures.

**Acceptance Criteria:**

**Given** a rendered Artifact contains a relative link to another file under the BMAD Root
**When** I follow it
**Then** that Artifact opens in the Reader (FR-5)
**And** `resolve-link.ts` maps relative href + source path to an in-root Reader URL
**And** the markdown pipeline applies this after sanitize
**And** a heading/hash link inside the current Artifact scrolls to that heading when present

**Given** a link the Showcase cannot resolve (missing file, outside allow-list, or broken href)
**When** the Reader renders it
**Then** the link is still visible
**And** it is marked unresolved (`{ unresolved: true }`, DESIGN.md `{colors.destructive}`) and still looks like a link (UX-DR4)
**And** it does not fail silently and does not navigate outside the allow-list

**Given** a `javascript:` or otherwise stripped href
**When** sanitize + resolve run
**Then** it is not an executable link in the Reader

### Story 2.4: Show honest empty and missing states, including dashboard’s own files

As Ubuntu,
I want to know when a Tree, Kind, or Artifact cannot be shown,
So that I trust the Showcase and can still find dashboard’s own BMAD files like any other Artifact.

**Acceptance Criteria:**

**Given** an empty BMAD Tree or a Kind with no Artifacts
**When** I open Docs (or that Kind group)
**Then** I see an empty state, not a blank page (FR-6, UX-DR14)
**And** copy is literal (e.g. one display line + one reason), not “Oops!” and not Sample World (NFR-2)

**Given** a listed Artifact is missing or unreadable
**When** I open it
**Then** the Reader shows “Unreadable Artifact.” plus a short reason
**And** the rest of the Catalog and chrome still work
**And** a single Artifact error does not fail the whole page; the whole page fails only if the allow-list root is unreadable
**And** server parse skips `console.warn` with a relative path and do not log file bodies

**Given** dashboard PRD, UX, architecture, and this epics file exist under `pocket-dimension`
**When** I open that Tree in Docs
**Then** those Artifacts appear and open like any other (FR-10)
**And** dashboard does not special-case itself

## Epic 3: See Features and walk Epics & Stories

Ubuntu can browse Features extracted from planning Artifacts, open the defining document, and use Delivery (board, table, Timeline) to open Epics and Stories. Status is read-only.

### Story 3.1: Browse Features extracted from planning Artifacts

As Ubuntu,
I want a Features list for the selected Tree,
So that I can see product shape without opening each PRD by path.

**Acceptance Criteria:**

**Given** the selected Tree has PRDs or equivalent planning Artifacts with Feature/FR sections
**When** I open Features
**Then** those Features and FR identifiers appear on the Features surface (FR-13, FR-9)
**And** each Feature row shows Feature/FR id, name, and source Artifact (UX-DR8)
**And** Features are extracted from planning Artifacts only — no second Feature database, no invented Features
**And** Feature remains a surface/extraction, not an `ArtifactKind`

**Given** I select a Feature
**When** I activate the row
**Then** the defining Artifact opens in the Reader (at that Artifact; heading jump if the id is in the document)

**Given** a Tree with no Feature/FR sections
**When** I open Features
**Then** I see “No Features in this Tree.” (or equivalent empty copy), not a blank page and not Sample World

**Given** I type in the Features filter
**When** text matches id or name
**Then** the list narrows; no match shows an empty list, not fake Features

### Story 3.2: Open Epics and Stories with optional status

As Ubuntu,
I want to open an Epic and its Stories,
So that I can read implementation work in context instead of as paths.

**Acceptance Criteria:**

**Given** Epic Artifacts exist in the selected Tree
**When** I view them as Kind Epic (Docs or Delivery)
**Then** they are listed as Artifact Kind Epic (FR-7)
**And** `/epics/[id]?tree=` opens that Epic in the Reader
**And** `[id]` is a slug from path/filename, unique per tree

**Given** I am on an Epic that references Stories by existing links or filenames
**When** those Story files exist
**Then** I can open each referenced Story (no separate story-index schema)
**And** a missing referenced Story does not hide the Epic; the broken ref is unresolved or omitted, not invented

**Given** Story Artifacts exist
**When** I list or open one
**Then** they are listed as Artifact Kind Story (FR-8)
**And** `/stories/[id]?tree=` opens the Story in the Reader
**And** title is visible in the Catalog or Reader header
**And** status is shown when present (`Status:` line or later Delivery projection); Stories without status still list and open
**And** there is a way back via Delivery (UX-DR11) once Delivery exists; until 3.3, back via Docs/nav is enough

### Story 3.3: Walk Delivery as board, table, and Timeline

As Ubuntu,
I want Epics and Stories on a Delivery board, a table, and a process Timeline,
So that I can see where work stands without writing status back to disk.

**Acceptance Criteria:**

**Given** Epic and Story Artifacts exist in the selected Tree
**When** I open Epics & Stories (`/delivery`)
**Then** one Delivery projection feeds board, table, and Timeline (FR-14, FR-15, UX-DR9)
**And** default view is **board**; chips switch Board / Table / Timeline
**And** URL `view` is `board` | `table` | `timeline`; `/timeline` redirects to `/delivery?view=timeline`
**And** selecting an Epic or Story opens that Artifact
**And** views do not re-parse status independently

**Given** status exists in `sprint-status.yaml` or a Story `Status:` line
**When** Delivery renders
**Then** precedence is (1) parseable `sprint-status.yaml`, (2) Story `Status:` line, (3) `unknown`
**And** code status is `'backlog' | 'in-progress' | 'done' | 'unknown'` plus `statusLabel` for the raw string
**And** extra sprint-status values map to `unknown` but keep the label
**And** missing sprint-status does not hide Epics or Stories that exist as files
**And** the UI never writes status to disk (no drag-to-change-status)

**Given** Timeline view
**When** I open it
**Then** Epics appear in document or process order with Stories under them (not a calendar)
**And** Epic milestones and Story nodes are openable
**And** status color is semantic, not decorative

**Given** a Tree with no Epics or Stories
**When** I open Delivery
**Then** I see “No Epics in this Tree.” (or equivalent), not a blank page and not Sample World

## Epic 4: Find a phrase and see which tests exist

Ubuntu can Search across Current BMAD Trees and open a hit, and can catalog real tests on disk with no runner and no Sample World.

### Story 4.1: Search Artifact content and open a hit

As Ubuntu,
I want to search Artifact body text with ⌘K or `/`,
So that I can jump to an FR or phrase without knowing the file.

**Acceptance Criteria:**

**Given** Current BMAD Trees have text Artifacts
**When** I press ⌘K / Ctrl+K, `/`, or the header Search button
**Then** a command overlay opens (not a card grid) (FR-12, UX-DR12)
**And** `/` does not steal focus when I am already in an editable field
**And** Esc closes the overlay and restores focus
**And** one overlay only; no modal stack
**And** Arrow keys highlight; Enter opens the highlighted hit
**And** keyboard alone can complete this flow (NFR-4)

**Given** I type a query
**When** Search runs
**Then** it matches case-insensitive substring or simple tokens inside Artifact content, not titles alone
**And** it uses `searchCorpus` for all Current BMAD Trees by default and can narrow to the Tree in view
**And** leftover/stale trees and binary/non-text files are skipped
**And** no query language, saved searches, MiniSearch, or ranking beyond “this text appears”
**And** each hit names Artifact, Kind, Tree, and a snippet; hit shape includes `{ kind, id, title, snippet, href, tree }`
**And** results are `aria-live`; groups may be Feature, Epic, Story, Test, Docs
**And** Search queries the current load snapshot (NFR-6)

**Given** I open a hit
**When** I press Enter
**Then** that Artifact opens in the matching surface (Reader / Feature / Story / Test)

**Given** a query with no matches
**When** results render
**Then** I see “No matches for {query}.” not a blank Catalog

### Story 4.2: Catalog tests that exist on disk

As Ubuntu,
I want a list of tests that actually exist,
So that I can see what is covered without a runner or Sample World.

**Acceptance Criteria:**

**Given** test files exist under `apps/**` (`*.test.ts` / `*.spec.ts` or equivalent)
**When** I open Tests
**Then** those files appear as Test rows (path or name) (FR-16, UX-DR13)
**And** the catalog reader lives in `$lib/server` (e.g. `tests-catalog.ts`), not BMAD classifiers
**And** Tests never scans `_bmad-output`
**And** there is no Run button and no in-dashboard execution

**Given** I select a listed test with a path
**When** I open it
**Then** I can open that source (or a related Story when a link exists)

**Given** the selected Tree
**When** I filter Tests
**Then** `zeo` prefixes `apps/zeo`, `chhan-chhan` prefixes `apps/chhan-chhan`, `pocket-dimension` shows the full catalog (no prefix)
**And** Tree filter is a join when a path/app link exists, not a BMAD-file scan

**Given** no tests are found
**When** I open Tests
**Then** I see “No tests found.” (empty Tests state)
**And** the surface does not seed or display Sample World or sample-data fixtures
