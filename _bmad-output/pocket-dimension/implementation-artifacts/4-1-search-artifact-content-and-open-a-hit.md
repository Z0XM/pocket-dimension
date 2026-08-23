---
story_id: "4.1"
story_key: 4-1-search-artifact-content-and-open-a-hit
epic: 4
depends_on: 3-3-walk-delivery-as-board-table-and-timeline
baseline_commit: a9930e1
---

# Story 4.1: Search Artifact content and open a hit

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->
<!-- Validation skipped per create-story invocation (skip validate-story workflow). -->

## Story

As Ubuntu,
I want to search Artifact body text with ⌘K or `/`,
so that I can jump to an FR or phrase without knowing the file.

## Acceptance Criteria

1. **Given** Current BMAD Trees have text Artifacts  
   **When** I press ⌘K / Ctrl+K, `/`, or the header Search button  
   **Then** a command overlay opens (not a card grid) (FR-12, UX-DR12)  
   **And** `/` does not steal focus when I am already in an editable field  
   **And** Esc closes the overlay and restores focus  
   **And** one overlay only; no modal stack  
   **And** Arrow keys highlight; Enter opens the highlighted hit  
   **And** keyboard alone can complete this flow (NFR-4)

2. **Given** I type a query  
   **When** Search runs  
   **Then** it matches case-insensitive substring or simple tokens inside Artifact content, not titles alone  
   **And** it uses `searchCorpus` for all Current BMAD Trees by default and can narrow to the Tree in view  
   **And** leftover/stale trees and binary/non-text files are skipped  
   **And** no query language, saved searches, MiniSearch, or ranking beyond “this text appears”  
   **And** each hit names Artifact, Kind, Tree, and a snippet; hit shape includes `{ kind, id, title, snippet, href, tree }`  
   **And** results are `aria-live`; groups may be Feature, Epic, Story, Test, Docs  
   **And** Search queries the current load snapshot (NFR-6)

3. **Given** I open a hit  
   **When** I press Enter  
   **Then** that Artifact opens in the matching surface (Reader / Feature / Story / Test)

4. **Given** a query with no matches  
   **When** results render  
   **Then** I see “No matches for {query}.” not a blank Catalog

## Tasks / Subtasks

- [x] Types + experience copy (AC: 2, 4)  
  - [x] **UPDATE** `apps/dashboard/src/lib/types.ts` — add:

    ```ts
    export type SearchHitKind = "feature" | "epic" | "story" | "test" | "docs";

    /** Preloaded text document for in-memory search (layout payload). */
    export type SearchCorpusEntry = {
      kind: SearchHitKind;
      id: string;
      title: string;
      tree: TreeId;
      text: string;   // full body used for matching (not titles alone)
      href: string;   // open target including ?tree= and optional #hash
    };

    /** Result row after query — architecture hit shape. */
    export type SearchHit = {
      kind: SearchHitKind;
      id: string;
      title: string;
      snippet: string;
      href: string;
      tree: TreeId;
    };

    export type LayoutTreeData = {
      trees: TreeId[];
      tree: TreeId | null;
      bmadRootError: string | null;
      snapshot: TreeSnapshot | null;
      snapshotError?: string | null;
      searchCorpus: SearchCorpusEntry[]; // NEW — all Current BMAD Trees
      // do NOT add `tests` catalog here — Story 4.2 owns that field
    };
    ```

  - [x] **UPDATE** `apps/dashboard/src/lib/experience-copy.ts` — search miss helper:

    ```ts
    searchNoMatches(query: string): { title: string; reason?: string }
    // title MUST be exactly: `No matches for ${query}.`
    // (EXPERIENCE.md / UX-DR14 — no soft copy)
    ```

- [x] Pure search engine (AC: 2, 4)  
  - [x] **NEW** `apps/dashboard/src/lib/catalog/search.ts` — **pure, no `fs`**:

    ```ts
    /** Case-insensitive: full query as substring OR every whitespace token appears as substring. */
    export function matchesQuery(haystack: string, query: string): boolean;

    /** ~80–120 chars around first match; plain text OK. Optional accent markers deferred to UI. */
    export function buildSnippet(haystack: string, query: string, radius?: number): string;

    export type SearchOptions = {
      /** When set, only entries with this tree. Default = all corpus. */
      tree?: TreeId | null;
    };

    /** Stable order: group order Feature → Epic → Story → Test → Docs, then path/title. No ranking scores. */
    export function searchCorpus(
      corpus: SearchCorpusEntry[],
      query: string,
      options?: SearchOptions
    ): SearchHit[];
    ```

  - [x] Empty / whitespace-only query → return `[]` (overlay shows empty list or prompt; miss copy only when query non-empty and zero hits).  
  - [x] **NEW** `apps/dashboard/src/lib/catalog/search.test.ts` — fixtures: body match not title-only; case-insensitive; multi-token AND; tree narrow; skip empty query; snippet contains match; no MiniSearch assumptions.

- [x] Server: build `searchCorpus` on layout load (AC: 2, NFR-6)  
  - [x] **NEW** `apps/dashboard/src/lib/server/load-search-corpus.ts`:

    1. For each `TreeId` in `listCurrentTrees().trees` (allow-list only — never glob leftover `_bmad-output/*`).  
    2. `loadTreeSnapshot(tree)` for each (same walk as Docs; extensions already `.md` / `.yaml` / `.yml`).  
    3. For each file Artifact: `readFileSync` utf8 via `resolveArtifactPath`; skip directories that are run-folders **or** index their `prd.md` primary text if present (same honesty as Reader). Skip unreadable (warn relative path; omit entry — never invent).  
    4. Reject binary: if buffer contains `\0` in first 8KB, skip (defense in depth beyond extension allow-list).  
    5. Map `artifactKind` → `SearchHitKind`:
       - `epic` → `"epic"`; href = `/epics/{id}?tree={tree}` (reuse `slugFromSourcePath` / ArtifactRef.id)  
       - `story` → `"story"`; href = `/stories/{id}?tree={tree}`  
       - else (`prd` | `ux` | `architecture` | `doc` | `unclassified`) → `"docs"`; href = `/docs/{encodePathSegments(sourcePath)}?tree={tree}`  
    6. **Feature entries (group Feature):** for each tree, reuse `loadFeaturesForTree` / `extractFeatures` on PRD markdown; for each `FeatureRow`, push corpus entry:

       ```ts
       {
         kind: "feature",
         id: feature.id,
         title: feature.name,
         tree,
         text: `${feature.id} ${feature.name}`, // plus optional nearby section body if cheap; must still match FR ids in body via Docs/PRD entries
         href: `/docs/${encodePathSegments(feature.sourcePath)}?tree=${tree}#${feature.headingSlug}`,
       }
       ```

       Prefer also appending a slice of PRD markdown around the FR heading when easy (improves “phrase in FR section” Feature hits). Do **not** invent Features absent from extractors.  
    7. **Test group:** emit **zero** `"test"` entries in this story. Do not scan `apps/**`. Search group heading “Test” may render empty (omit empty groups). Story 4.2 fills Tests catalog + optional test corpus later.  
    8. Return flat `SearchCorpusEntry[]`. Same request as layout — no cross-navigation cache (NFR-6).

  - [x] **UPDATE** `apps/dashboard/src/routes/+layout.server.ts` — extend return:

    ```ts
    return {
      trees,
      tree,
      bmadRootError: bmadRootError ?? null,
      snapshot,
      snapshotError,
      searchCorpus: loadSearchCorpus(trees), // or pass trees list
    };
    ```

    Keep `snapshot` = **selected Tree only**. `searchCorpus` = **all** Current trees. Do not merge all trees into `snapshot`.

- [x] One keyboard registry (AC: 1, NFR-4)  
  - [x] **NEW** `apps/dashboard/src/lib/keyboard.ts` (client module — architecture path):

    ```ts
    export function isEditableTarget(target: EventTarget | null): boolean;
    // true for input, textarea, select, contentEditable, role=textbox, [data-search-input]

    export type SearchKeyboardHandlers = {
      open: () => void;
      toggle?: () => void;
      isOpen: () => boolean;
    };

    /** Single owner of ⌘K / Ctrl+K and `/`. Returns destroy(). */
    export function bindSearchHotkeys(handlers: SearchKeyboardHandlers): () => void;
    ```

  - [x] Rules:  
    - `metaKey|ctrlKey` + `k` → `preventDefault`, open (or toggle) Search.  
    - bare `/` → open Search **only if** `!isEditableTarget(event.target)` and overlay not already owning the key (once open, Search input owns typing including `/`).  
    - Esc: prefer Dialog’s built-in close; registry must not open a second overlay.  
    - **One** `window`/`document` listener pair for the app — call from shell `onMount` / `$effect`, destroy on teardown. Do **not** duplicate listeners in overlay + layout.  
  - [x] Optional tiny unit test for `isEditableTarget` if easy without DOM harness; otherwise cover via manual checklist.

- [x] Search overlay UI (AC: 1–4, UX-DR12, UX-DR4, UX-DR3)  
  - [x] **NEW** `apps/dashboard/src/lib/components/search-overlay.svelte`:

    - Use existing shadcn **`Command.Dialog`** (`$lib/components/ui/command`) — **not** a card grid.  
    - Props: `open` bindable; `corpus: SearchCorpusEntry[]`; `tree: TreeId | null` (for “This tree” scope default context); `onClose` / focus restore hook.  
    - Local runes: `query`, `scope: "all" | "tree"` (default `"all"`).  
    - Derive hits: `searchCorpus(corpus, query, scope === "tree" ? { tree } : undefined)`.  
    - **Critical:** pass `shouldFilter={false}` on Command root so bits-ui does **not** re-filter by item title only (body matches would vanish).  
    - Render groups with headings **Feature / Epic / Story / Test / Docs** — omit empty groups.  
    - Each hit: title + meta line `{Kind} · {tree} · …`; snippet under title; active row = surface fill + accent **left hairline** (UX-DR4), not filled violet block. Match span: accent underline/color, not highlight wash (mockup `mockups/search.html`).  
    - Enter / item select → `goto(hit.href)` (SvelteKit) then close overlay. Prefer `Command.LinkItem` **or** Item + `goto` — preserve query/hash.  
    - Empty non-blank query: `Command.Empty` text = `No matches for {query}.` via experience-copy.  
    - `aria-live="polite"` on results region (count or miss).  
    - Radius/shadow: Search panel may use dialog shadow (UX-DR3); no glass stack.  
    - Type chips optional — skip unless trivial.

  - [x] **UPDATE** `apps/dashboard/src/lib/components/app-shell.svelte`:  
    - Accept `searchCorpus`.  
    - Header **Search** button (desktop aside + mobile header) opens overlay.  
    - Mount `<SearchOverlay bind:open … />` once.  
    - `onMount` → `bindSearchHotkeys`; destroy on cleanup.  
    - Focus restore: store `document.activeElement` on open; restore on close (Dialog may help; verify).  
    - Mobile Sheet + Search: Search Dialog may sit above Sheet; do **not** open a second product dialog from Search (UX-DR15 max depth = Search).

  - [x] **UPDATE** `apps/dashboard/src/routes/+layout.svelte` — pass `searchCorpus={data.searchCorpus}` into AppShell.

- [x] Preserve contracts / out of scope  
  - [x] Do **not** implement Tests catalog / `tests-catalog.ts` / Tests surface content (4.2). Tests page stays stub.  
  - [x] Do **not** add MiniSearch, file watcher, query language, saved searches, ranking scores.  
  - [x] Do **not** write status to disk; no Sample World; no §6.3 nav.  
  - [x] Do **not** put all trees into `snapshot`; do not change Docs/Features/Delivery projection contracts.  
  - [x] Track dashboard process only in `sprint-status-dashboard.yaml` — never overwrite rhymes `sprint-status.yaml`.  
  - [x] No edits under `apps/pocket/**`.  
  - [x] No new markdown libraries; search is substring/token over plain text already loaded.

- [x] Verify (AC: 1–4)  
  - [x] `cd apps/dashboard && bun test src` (include `search.test.ts`)  
  - [x] `cd apps/dashboard && bun run check`  
  - [x] Manual: ⌘K / Ctrl+K / header Search / `/` open overlay; Esc restores focus; `/` inside Features filter or Search input does not re-trigger steal.  
  - [x] Query `FR-12` on pocket-dimension → Feature and/or Docs hits with snippets; Enter opens Reader (hash for Feature).  
  - [x] Query unique zeo phrase while `?tree=pocket-dimension` with scope All → zeo hit; narrow to This tree → zeo gone.  
  - [x] Nonsense query → `No matches for {query}.`  
  - [x] Arrow keys + Enter keyboard-only path works.  
  - [x] Only one overlay; leftover trees never appear.  
  - [x] `/health` still OK; Delivery/Features/Docs unchanged.

## Dev Notes

### Scope boundary (critical)

| In scope | Out of scope |
| --- | --- |
| `searchCorpus` on layout + in-memory substring/token search | MiniSearch / watcher / saved searches / operators |
| `keyboard.ts` single registry + `search-overlay.svelte` | Tests catalog / `apps/**` scan (4.2) |
| Groups Feature, Epic, Story, Docs; Test stub empty | Filling Test hits or Tests page |
| Header Search + ⌘K / Ctrl+K / `/` | Modal stacks deeper than Search; second overlay |
| Hit → existing routes (`/docs`, `/epics`, `/stories`, Feature hash) | New Reader routes; write-back |

### Exhaustive current-state analysis (read before coding)

**Baseline tip `a9930e1` (Epic 3 done; Epic 4 not started).**

#### Layout payload today — `searchCorpus` does NOT exist

```28:35:apps/dashboard/src/routes/+layout.server.ts
  return {
    trees,
    tree,
    bmadRootError: bmadRootError ?? null,
    snapshot,
    snapshotError,
  };
```

`LayoutTreeData` in `types.ts` is `{ trees, tree, bmadRootError, snapshot, snapshotError? }` only. Architecture closure requires `{ trees, tree, snapshot, searchCorpus, tests }` — this story adds **`searchCorpus` only**; leave **`tests` for 4.2** (do not invent an empty tests scanner).

`snapshot` remains **selected Tree** via `loadTreeSnapshot(tree)`. Corpus builder must call snapshot (or equivalent walk) **per allow-listed tree** independently.

#### App shell / keyboard today — nothing wired

- `app-shell.svelte`: TreeSwitcher + SectionNav + mobile Sheet. **No Search button, no overlay, no hotkeys.**  
- **No** `src/lib/keyboard.ts`.  
- **No** `src/lib/catalog/search.ts`.  
- **No** `search-overlay.svelte`.  
- shadcn **command** + **dialog** already vendored under `$lib/components/ui/command` (bits-ui `Command.Dialog`). Ready to compose — do not reinstall.

#### bits-ui Command filter trap (HALT if ignored)

bits-ui Command defaults `shouldFilter: true` and scores **item value / keywords**, not Artifact bodies. If you render all corpus as items and type in `Command.Input`, body-only matches disappear.

**Required pattern:** compute hits with `$lib/catalog/search.ts`, render **only those hits**, set **`shouldFilter={false}`** on Command root (supported in bits-ui 2.x `CommandRootProps`).

#### Href contracts to reuse (do not invent)

| Kind | Open surface | Pattern (already in app) |
| --- | --- | --- |
| Feature | Docs Reader + hash | `feature-row.svelte`: `/docs/{encoded}?tree=#headingSlug` |
| Epic | Epic Reader | `/epics/{id}?tree=` (`delivery-board`, `resolve-link`) |
| Story | Story Reader | `/stories/{id}?tree=` |
| Docs | Docs Reader | `/docs/{encoded}?tree=` |
| Test | — | **No hits until 4.2**; Tests page remains stub |

Reuse `encodePathSegments` (`docs-path.ts`), `sectionHref` / query `tree`, Feature `headingSlug` from extractor.

#### Text available for matching

- `ArtifactRef` today has **no body** — only metadata from file head in `read-tree`. Corpus loader must **read full file text** for search (separate from sanitize HTML pipeline). Search matches **plain source text**, not sanitized HTML.  
- Do **not** fork a second markdown→HTML parser for search.  
- Catalog extensions already exclude binaries (`.md`/`.yaml`/`.yml` only). Still skip `\0` and unreadable paths.

#### Features vs Docs duplicate hits

Query `FR-12` may hit both a **Feature** entry and the **Docs/PRD** Artifact that contains the heading. That is acceptable v1 honesty (UX groups both). Do not dedupe away Feature group — Epic AC lists Feature as a group.

#### Freshness (NFR-6)

One layout `load` builds `snapshot` + `searchCorpus` from disk at request time. Client Search must query the **props corpus from that load**, not a stale client cache or boot-time index. Navigating (incl. Tree change) reloads layout → new corpus.

#### UX / copy anchors

- Overlay: command palette (`mockups/search.html`, EXPERIENCE Flow 4).  
- Miss: exactly `No matches for {query}.`  
- Active hit: accent left hairline + surface; match underline/color (DESIGN.md search-hit-active).  
- Keyboard: ⌘K / Ctrl+K, `/`, Esc, arrows, Enter (EXPERIENCE Interaction Primitives).

### Architecture compliance (must follow)

- Search = case-insensitive substring/token over load payload; **no MiniSearch** — [Source: architecture-dashboard.md Important Decisions + Gap closures]  
- Layout payload: `searchCorpus` = all Current BMAD Trees; default search all; optional narrow to `tree` — [Source: architecture § Gap Analysis Critical #1]  
- Hit shape `{ kind, id, title, snippet, href, tree }` — [Source: architecture Important Gaps]  
- Files: `search.ts`, `search-overlay.svelte`, `keyboard.ts`; shell owns overlay state — [Source: architecture Project Structure + FR mapping]  
- One keyboard registry; `/` does not steal in editable fields — [Source: architecture Frontend + Important Gaps]  
- Named absences: watcher, MiniSearch, Sample World, test runner, §6.3 — do not implement

### Previous story intelligence (3.3 → 4.1)

- Delivery projection + board/table/timeline done; status map includes `in-progress`.  
- Epic/Story open via `/epics/[id]` and `/stories/[id]` with `?tree=` — Search must use same hrefs.  
- Features extraction + hash jump already proven (3.1) — reuse for Feature group.  
- Explicit deferrals across Epic 1–3: Search overlay, `keyboard.ts`, `searchCorpus` land **here**.  
- Process tracking file remains `sprint-status-dashboard.yaml` (not Delivery’s `sprint-status.yaml`).

### Git intelligence (recent)

- `a9930e1` / `3e654c0` — Delivery surfaces  
- `4209090` — Epic/Story Reader routes  
- `e517759` — Features extract  
Pattern: pure `$lib/catalog/*` + `$lib/server/load-*` + thin routes; bun tests beside modules.

### Library / framework requirements

| Piece | Use |
| --- | --- |
| Overlay | Existing `$lib/components/ui/command` + dialog (bits-ui ^2.16 / installed 2.18) |
| Navigation | `goto` from `$app/navigation` or `Command.LinkItem` |
| State | Svelte 5 runes only — overlay open/query/scope local |
| Search algo | Hand-rolled in `search.ts` — **no** new npm deps |
| Markdown | Unchanged server sanitize pipeline — Search does not call it |

### Project structure notes

Align with architecture tree:

```
apps/dashboard/src/lib/keyboard.ts                 # NEW
apps/dashboard/src/lib/catalog/search.ts           # NEW
apps/dashboard/src/lib/catalog/search.test.ts      # NEW
apps/dashboard/src/lib/server/load-search-corpus.ts # NEW
apps/dashboard/src/lib/components/search-overlay.svelte # NEW
apps/dashboard/src/lib/components/app-shell.svelte  # UPDATE
apps/dashboard/src/routes/+layout.server.ts        # UPDATE
apps/dashboard/src/routes/+layout.svelte           # UPDATE
apps/dashboard/src/lib/types.ts                    # UPDATE
apps/dashboard/src/lib/experience-copy.ts          # UPDATE
```

### Testing requirements

- Unit: `search.test.ts` (match / snippet / tree filter / empty query).  
- Optional: small corpus-builder test with temp tree fixtures (follow `load-by-slug.test.ts` pattern) if feasible.  
- Manual keyboard + open-hit path mandatory (NFR-4 / UJ-4).  
- Regression: `bun test src`, `bun run check`, Delivery/Features/Docs smoke, `/health`.

### Project context reference

- Dashboard is standalone on **3011**, no auth/DB.  
- BMAD trees: `_bmad-output/{pocket-dimension,zeo,chhan-chhan}/` only.  
- Knowledge under `_bmad-output/pocket-dimension/` — do not write repo-root `docs/`.

### References

- [Source: `_bmad-output/pocket-dimension/planning-artifacts/epics-dashboard.md` — Epic 4 / Story 4.1]  
- [Source: `_bmad-output/pocket-dimension/planning-artifacts/architecture-dashboard.md` — Search, keyboard, layout payload closures]  
- [Source: `_bmad-output/pocket-dimension/planning-artifacts/prds/prd-dashboard-2026-08-23/prd.md` — FR-12, UJ-4, NFR-4, NFR-6]  
- [Source: `ux-designs/ux-dashboard-2026-08-23/EXPERIENCE.md` — Search palette, Flow 4, miss copy]  
- [Source: `ux-designs/ux-dashboard-2026-08-23/DESIGN.md` — search-hit-active]  
- [Source: `ux-designs/ux-dashboard-2026-08-23/mockups/search.html`]  
- [Source: implementation-artifacts `3-1` / `3-2` / `3-3` — deferred Search; href contracts]

### Story completion status

done — Search overlay, corpus loader, keyboard registry, and tests implemented.

## Dev Agent Record

### Completion Notes

- Added `searchCorpus` to layout payload (all Current BMAD Trees) while keeping `snapshot` selected-tree only.
- Pure substring/token search in `search.ts` with `shouldFilter={false}` Command overlay.
- Single `keyboard.ts` hotkey registry (⌘K/Ctrl+K, `/`) with editable-target guard.
- No Tests catalog / MiniSearch / test corpus entries (deferred to 4.2).
- `bun test src`: 132 pass; `bun run check`: 0 errors.

### File List

- `apps/dashboard/src/lib/types.ts`
- `apps/dashboard/src/lib/experience-copy.ts`
- `apps/dashboard/src/lib/experience-copy.test.ts`
- `apps/dashboard/src/lib/catalog/search.ts`
- `apps/dashboard/src/lib/catalog/search.test.ts`
- `apps/dashboard/src/lib/server/load-search-corpus.ts`
- `apps/dashboard/src/lib/keyboard.ts`
- `apps/dashboard/src/lib/keyboard.test.ts`
- `apps/dashboard/src/lib/components/search-overlay.svelte`
- `apps/dashboard/src/lib/components/app-shell.svelte`
- `apps/dashboard/src/routes/+layout.server.ts`
- `apps/dashboard/src/routes/+layout.svelte`
- `_bmad-output/pocket-dimension/implementation-artifacts/sprint-status-dashboard.yaml`

## Change Log

- 2026-08-23: Story 4.1 — artifact body search command overlay with layout `searchCorpus`, keyboard registry, and grouped hits.

## HALT / Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| bits-ui default `shouldFilter` hides body matches | **HALT-level** if ignored | Always `shouldFilter={false}` + precompute hits in `search.ts` |
| Putting all trees into `snapshot` | High regression | Keep `snapshot` = selected tree; only `searchCorpus` is multi-tree |
| Implementing Tests catalog “while here” | Scope creep | Test group empty; no `apps/**` scan until 4.2 |
| Duplicate hotkey listeners | Overlay bugs / focus loss | Single `keyboard.ts` registry from shell only |
| Layout load cost reading all file bodies | Medium | Acceptable at 3 small trees; no cross-request cache; warn+skip unreadable |
| `/` steals from Features page filter input | AC fail | `isEditableTarget` gate before open |
| Soft miss copy | UX fail | Exact `No matches for {query}.` via experience-copy |

No document blockers — proceed to `dev-story`.
