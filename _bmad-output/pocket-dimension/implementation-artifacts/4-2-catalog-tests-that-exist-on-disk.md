---
story_id: "4.2"
story_key: 4-2-catalog-tests-that-exist-on-disk
epic: 4
depends_on: 4-1-search-artifact-content-and-open-a-hit
baseline_commit: c3815ee
---

# Story 4.2: Catalog tests that exist on disk

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->
<!-- Validation skipped per create-story invocation (skip validate-story workflow). -->

## Story

As Ubuntu,
I want a list of tests that actually exist,
so that I can see what is covered without a runner or Sample World.

## Acceptance Criteria

1. **Given** test files exist under `apps/**` (`*.test.ts` / `*.spec.ts` or equivalent)  
   **When** I open Tests  
   **Then** those files appear as Test rows (path or name) (FR-16, UX-DR13)  
   **And** the catalog reader lives in `$lib/server` (e.g. `tests-catalog.ts`), not BMAD classifiers  
   **And** Tests never scans `_bmad-output`  
   **And** there is no Run button and no in-dashboard execution

2. **Given** I select a listed test with a path  
   **When** I open it  
   **Then** I can open that source (or a related Story when a link exists)

3. **Given** the selected Tree  
   **When** I filter Tests  
   **Then** `zeo` prefixes `apps/zeo`, `chhan-chhan` prefixes `apps/chhan-chhan`, `pocket-dimension` shows the full catalog (no prefix)  
   **And** Tree filter is a join when a path/app link exists, not a BMAD-file scan

4. **Given** no tests are found  
   **When** I open Tests  
   **Then** I see “No tests found.” (empty Tests state)  
   **And** the surface does not seed or display Sample World or sample-data fixtures

## Tasks / Subtasks

- [x] Types + experience copy (AC: 1, 4)  
  - [x] **UPDATE** `apps/dashboard/src/lib/types.ts` — add:

    ```ts
    /** One on-disk test file from apps/** (layout `tests` field). */
    export type TestCatalogEntry = {
      id: string; // stable slug from sourcePath (reuse slug helpers or path-based kebab)
      name: string; // basename (e.g. snapshot.test.ts) — row primary label OK
      sourcePath: string; // repo-relative posix, e.g. apps/zeo/src/lib/server/game/snapshot.test.ts
      /** Tree join from path prefix; null when path is not under apps/zeo or apps/chhan-chhan */
      treeHint: TreeId | null;
      /** Optional Story Reader href when a real link exists; otherwise null/omit — do not invent */
      relatedStoryHref?: string | null;
      /** Open-source target inside the app (see routes below) */
      href: string;
    };

    export type LayoutTreeData = {
      trees: TreeId[];
      tree: TreeId | null;
      bmadRootError: string | null;
      snapshot: TreeSnapshot | null;
      snapshotError?: string | null;
      searchCorpus: SearchCorpusEntry[];
      tests: TestCatalogEntry[]; // NEW — full repo catalog; page filters by selected tree
    };
    ```

  - [ ] **UPDATE** `apps/dashboard/src/lib/experience-copy.ts` — Tests empty (UX-DR13 / epic AC win over stub):

    ```ts
    testsEmpty: {
      title: "No tests found.",
      // optional short reason OK; do NOT use "No Tests in this Tree."
    },
    ```

    Replace stub copy on `/tests`. EXPERIENCE “etc.” line that mirrors Features is **overridden** by UX-DR13 literal **“No tests found.”**

- [ ] Server catalog reader (AC: 1, 3)  
  - [ ] **NEW** `apps/dashboard/src/lib/server/tests-catalog.ts` — **fs only here** (architecture name; not BMAD parsers):

    ```ts
    /** Scan apps/** for *.test.ts / *.spec.ts (and *.test.js / *.spec.js if cheap). Never _bmad-output. */
    export function loadTestsCatalog(repoRoot?: string): TestCatalogEntry[];
    ```

    Rules:  
    1. Resolve workspace root via **`resolveBmadRoot()`** (same monorepo root as BMAD). If root fails, return `[]` (warn once) — do not invent fixtures.  
    2. Walk **only** `join(root, "apps")` after `realpath`. Reject any path whose realpath is outside that `apps` realpath (symlink escape).  
    3. Match files: `*.test.ts`, `*.spec.ts` (equivalent: `*.test.js` / `*.spec.js` optional). Skip `node_modules`, `.svelte-kit`, `dist`, `build`, `.git`.  
    4. **Never** open or list `_bmad-output` for this catalog.  
    5. `sourcePath` = posix path relative to repo root (`apps/...`).  
    6. `treeHint`: `apps/zeo/...` → `"zeo"`; `apps/chhan-chhan/...` → `"chhan-chhan"`; else `null`.  
    7. `href`: `/tests/{encodePathSegments(sourcePath)}` (+ preserve `?tree=` at link time in UI).  
    8. `relatedStoryHref`: leave `null` unless a **cheap, honest** link already exists — do **not** scan BMAD trees to invent Story links.  
    9. Stable sort by `sourcePath`. No Sample World / sample-data seeding.  
    10. Unreadable file → `console.warn` relative path; omit row (never fake).

  - [ ] **NEW** `apps/dashboard/src/lib/server/tests-catalog.test.ts` — temp `apps/` fixture under a fake repo root with `_bmad-output/` present (so root resolve works when injected):  
    - finds `apps/zeo/.../*.test.ts` and `apps/chhan-chhan/.../*.spec.ts`  
    - ignores files under `_bmad-output` even if named `*.test.ts`  
    - ignores outside-`apps` paths  
    - `treeHint` mapping correct  
    - empty `apps/` → `[]`

  - [ ] **NEW** pure filter (no fs) — prefer `$lib/catalog/filter-tests.ts` (or export beside catalog types):

    ```ts
    export function filterTestsForTree(tests: TestCatalogEntry[], tree: TreeId | null): TestCatalogEntry[]
    ```

    | Selected tree | Filter |
    | --- | --- |
    | `zeo` | `sourcePath` starts with `apps/zeo/` (or `treeHint === "zeo"`) |
    | `chhan-chhan` | `apps/chhan-chhan/` |
    | `pocket-dimension` | **no prefix** — return full catalog |
    | `null` | `[]` or full? Prefer `[]` if no tree selected |

    Unit-test this join. **Not** a BMAD-file scan.

- [ ] Layout payload (AC: 1, 3)  
  - [ ] **UPDATE** `apps/dashboard/src/routes/+layout.server.ts` — add:

    ```ts
    tests: loadTestsCatalog(),
    ```

    Keep `snapshot` = selected Tree only; `searchCorpus` = BMAD (+ optional test entries below). `tests` = **repo-wide** list every navigation (NFR-6 freshness; no cross-request cache).

- [ ] Open source surface (AC: 2)  
  - [ ] **NEW** `apps/dashboard/src/routes/tests/[...path]/+page.server.ts` — read one allow-listed file:  
    - Decode `params.path` → repo-relative `sourcePath`  
    - Resolve `realpath` under `apps/` only; else error DTO (“Unreadable Artifact.” / honest reason — do not serve escape)  
    - Return `{ sourcePath, name, text }` plain utf8 (skip binary `\0`)  
  - [ ] **NEW** `apps/dashboard/src/routes/tests/[...path]/+page.svelte` — show path + `<pre>` / monospace body via **text nodes** (do **not** `{@html}` raw source). No Run button. Optional link to `relatedStoryHref` only if present on the entry (pass from list or re-derive null).  
  - [ ] List row uses `test-row` → `goto` / `<a href={sectionHref(entry.href, tree)}>`.

  Architecture tree lists only `tests/+page.svelte`; nested `[...path]` is required to satisfy “open that source” without an IDE protocol. Keep it read-only.

- [ ] Tests list UI (AC: 1–4, UX-DR13)  
  - [ ] **NEW** `apps/dashboard/src/lib/components/test-row.svelte` — path or name; accent left hairline on hover/active (UX-DR4); **no** Run control.  
  - [ ] **UPDATE** `apps/dashboard/src/routes/tests/+page.svelte` — replace stub:

    ```svelte
    // derive visible = filterTestsForTree(data.tests, data.tree)
    // empty → HonestState EXPERIENCE_COPY.testsEmpty ("No tests found.")
    // else → <ul> of TestRow
    ```

    Remove `"No Tests in this Tree."` and the debug “Tree: …” line (Tree already in chrome).

- [ ] Search Test group — fill without expanding Search product (AC: in-scope companion to 4.1)  
  - [ ] **UPDATE** `apps/dashboard/src/lib/server/load-search-corpus.ts` — after BMAD corpus, append one `SearchCorpusEntry` per `loadTestsCatalog()` row:

    ```ts
    {
      kind: "test",
      id: entry.id,
      title: entry.name, // or sourcePath
      tree: entry.treeHint ?? "pocket-dimension",
      text: entry.sourcePath, // enough for path/name queries; optional: read file body if cheap
      href: entry.href, // open Tests source route; UI may append ?tree=
    }
    ```

    Reuse existing `searchCorpus` / overlay / groups — **no** MiniSearch, no query language, no runner.  
    **Asymmetry (document, do not “fix”):** Tests page for `pocket-dimension` shows **full** catalog; Search “This tree” on `pocket-dimension` only hits entries with `tree === "pocket-dimension"` (non-zeo/non-chhan paths). Default Search **All trees** still finds every test. Acceptable v1.

- [ ] Preserve contracts / out of scope  
  - [ ] Do **not** add a test runner, Run button, vitest/bun invoke from UI, L1–L5 model, or Sample World / sample-data fixtures (`deferred-work.md`).  
  - [ ] Do **not** scan `_bmad-output` for tests or put `fs` in `$lib/catalog`.  
  - [ ] Do **not** add MiniSearch, watcher, or §6.3 nav.  
  - [ ] Do **not** mark `epic-4` done in sprint status (last story file creation ≠ epic complete — epic stays `in-progress` until 4.2 implementation is `done`).  
  - [ ] Track process only in `sprint-status-dashboard.yaml` — never overwrite rhymes `sprint-status.yaml`.  
  - [ ] No edits under `apps/pocket/**`.

- [ ] Verify (AC: 1–4)  
  - [ ] `cd apps/dashboard && bun test src` (include `tests-catalog.test.ts` + filter tests)  
  - [ ] `cd apps/dashboard && bun run check`  
  - [ ] Manual: `/tests?tree=zeo` → only `apps/zeo/**` rows (e.g. livekit / snapshot tests); `chhan-chhan` → importers/finance; `pocket-dimension` → full list including dashboard + zeo + chhan-chhan.  
  - [ ] Open a row → source visible; no Run.  
  - [ ] Empty fixture / forced empty → exactly `No tests found.`  
  - [ ] Search (⌘K) for a known basename e.g. `snapshot.test` → Test group hit → opens source route.  
  - [ ] Confirm catalog does not list anything from `_bmad-output`.  
  - [ ] Regression: Features / Delivery / Docs / Search BMAD hits unchanged; `/health` OK.

## Dev Notes

### Scope boundary (critical)

| In scope | Out of scope |
| --- | --- |
| `tests-catalog.ts` scan of `apps/**` + layout `tests` | Test runner / Run button / bun|vitest from UI |
| Tree prefix join filter | BMAD-file scan for tests; Sample World |
| `test-row` + `/tests` list + open source route | MiniSearch; new Search product features beyond Test hits |
| Optional SearchCorpus `kind: "test"` entries | Invented related Story links; writing to disk |
| Empty copy `No tests found.` | Stub copy `No Tests in this Tree.` |

### Exhaustive current-state analysis (read before coding)

**Baseline tip `c3815ee` (Story 4.1 done; Epic 4 last story).**

#### `/tests` stub today — wrong empty copy

```1:17:apps/dashboard/src/routes/tests/+page.svelte
<script lang="ts">
  import type { LayoutTreeData } from "$lib/types";

  let { data }: { data: LayoutTreeData } = $props();
</script>
…
  <h1 class="text-display text-foreground">Tests</h1>
  <p class="text-muted-foreground">No Tests in this Tree.</p>
```

Replace with real catalog + HonestState. UX-DR13 / epic AC require **“No tests found.”** — not the Features-style “No Tests in this Tree.”

#### Layout payload — `tests` field missing

```29:36:apps/dashboard/src/routes/+layout.server.ts
  return {
    trees,
    tree,
    bmadRootError: bmadRootError ?? null,
    snapshot,
    snapshotError,
    searchCorpus: loadSearchCorpus(trees),
  };
```

Architecture closure: `{ trees, tree, snapshot, searchCorpus, tests }`. Story 4.1 added `searchCorpus` only and explicitly deferred `tests` + Test Search group to **this** story.

`LayoutTreeData` has no `tests` yet — add it.

#### No `tests-catalog.ts` / `test-row.svelte`

`src/lib/server/` has `bmad-root`, `read-tree`, `load-search-corpus`, etc. — **no** tests catalog. Components have `feature-row`, not `test-row`. Create both per architecture FR-16 mapping.

#### Disk reality (expected hits when scanning this checkout)

~31 `*.test.ts` under `apps/` today, including:

- `apps/zeo/src/lib/**/*.test.ts` (livekit, call, game snapshot, …)  
- `apps/chhan-chhan/src/lib/importers/*.test.ts`, `finance/*.test.ts`  
- `apps/dashboard/src/lib/**/*.test.ts` (catalog/server/nav/search/…)  

No `*.spec.ts` currently required, but matcher must still accept them. No test files under `_bmad-output` should ever appear.

#### Tree filter = path join (architecture Important Gap)

| Tree | Tests list |
| --- | --- |
| `zeo` | prefix `apps/zeo` |
| `chhan-chhan` | prefix `apps/chhan-chhan` |
| `pocket-dimension` | **full catalog** (no prefix) |

Reuse layout `data.tree` (URL `?tree=`). Do not re-read BMAD to decide which tests exist.

#### Open source

No IDE/`vscode://` requirement. Implement in-app read-only source via `/tests/[...path]` under `apps/` allow-list + realpath containment (same security posture as `bmad-root` / `resolveArtifactPath`). Display as escaped text in `<pre>`, not unsanitized `{@html}`.

Related Story: AC allows “when a link exists” — v1 default **`relatedStoryHref: null`**. Do not crawl stories to guess links.

#### Search Test group (4.1 stub → 4.2 fill)

`load-search-corpus.ts` currently emits feature/epic/story/docs only — zero `kind: "test"`. Overlay already supports group heading **Test** (omit empty groups). Appending test corpus entries is in scope **without** changing search algorithm or adding MiniSearch.

#### Patterns to copy

- List + HonestState: `routes/features/+page.svelte` + `honest-state.svelte`  
- Row chrome: `feature-row.svelte` (hairline, mono path)  
- Root resolve: `resolveBmadRoot()` from `bmad-root.ts`  
- Fixture tests: `bmad-root.test.ts` / `read-tree.test.ts` temp dirs  
- Path encoding: `encodePathSegments` from `$lib/docs-path`  

#### Named absences

No Run, no Sample World, no `_bmad-output` test scan, no public API, no auth/DB, no watcher, no MiniSearch — [Source: architecture anti-patterns + PRD §6.3 / deferred-work.md].

### Architecture compliance (must follow)

- Dual corpus: BMAD vs `apps/**` tests; separate reader — [Source: architecture-dashboard.md Data Architecture + Cross-Component Dependencies]  
- File: `$lib/server/tests-catalog.ts`; UI: `routes/tests/`, `test-row.svelte` — [Source: Project Structure + FR mapping FR-16]  
- Never scan `_bmad-output` for tests — [Source: Critical Decisions + Anti-Patterns]  
- Layout payload includes `tests` — [Source: Gap Analysis Critical #1]  
- Tree filter prefixes as table above — [Source: Important Gaps]  
- `fs` only in `$lib/server`; pure filter in `$lib/catalog` — [Source: Structure Patterns]  
- Display-only; no write endpoints — [Source: Critical Decisions]

### Previous story intelligence (4.1 → 4.2)

- Search overlay, `keyboard.ts`, `searchCorpus`, `shouldFilter={false}` — leave intact; only extend corpus with tests.  
- 4.1 explicitly: “Test group: emit zero test entries”; “do NOT add `tests` catalog here — Story 4.2 owns that field.”  
- Do not put all trees into `snapshot`.  
- Process file: `sprint-status-dashboard.yaml` only.  
- Completion bar for Epic 4: after this story is **implemented and marked done**, epic may be closed — **create-story must leave `epic-4: in-progress`**.

### Git intelligence (recent)

- `c3815ee` — Search overlay / `searchCorpus` (4.1)  
- `a9930e1` / `3e654c0` — Delivery  
- Pattern: `$lib/server/load-*.ts` + `$lib/catalog/*` pure + thin routes + co-located `*.test.ts`

### Library / framework requirements

| Piece | Use |
| --- | --- |
| Scan | Node `fs` / Bun under `$lib/server` only — no new npm deps |
| UI | Existing HonestState, accent hairline rows; no new card grid |
| Search | Existing `search.ts` + overlay — append corpus entries only |
| Markdown pipeline | Not required for TS source view — plain text `<pre>` |
| Runner | **None** |

### Project structure notes

```
apps/dashboard/src/lib/types.ts                         # UPDATE — TestCatalogEntry, LayoutTreeData.tests
apps/dashboard/src/lib/experience-copy.ts               # UPDATE — testsEmpty
apps/dashboard/src/lib/catalog/filter-tests.ts          # NEW — pure tree join
apps/dashboard/src/lib/catalog/filter-tests.test.ts     # NEW
apps/dashboard/src/lib/server/tests-catalog.ts          # NEW
apps/dashboard/src/lib/server/tests-catalog.test.ts     # NEW
apps/dashboard/src/lib/server/load-search-corpus.ts      # UPDATE — kind: "test" entries
apps/dashboard/src/lib/components/test-row.svelte       # NEW
apps/dashboard/src/routes/+layout.server.ts             # UPDATE — tests:
apps/dashboard/src/routes/tests/+page.svelte            # UPDATE — list / empty
apps/dashboard/src/routes/tests/[...path]/+page.server.ts  # NEW
apps/dashboard/src/routes/tests/[...path]/+page.svelte     # NEW
```

### Testing requirements

- Unit: catalog discovery, ignore `_bmad-output`, treeHint, `filterTestsForTree` matrix (zeo / chhan-chhan / pocket-dimension).  
- Optional: source route reject path outside `apps/`.  
- Manual: Tree switch filter, open source, empty copy, Search Test hit.  
- Regression: `bun test src`, `bun run check`.

### Project context reference

- Dashboard standalone port **3011**; no auth/DB.  
- BMAD trees only under `_bmad-output/{pocket-dimension,zeo,chhan-chhan}/` — tests are **not** BMAD Artifacts.  
- Knowledge stays in `_bmad-output/pocket-dimension/` — no repo-root `docs/`.

### References

- [Source: `_bmad-output/pocket-dimension/planning-artifacts/epics-dashboard.md` — Epic 4 / Story 4.2]  
- [Source: `_bmad-output/pocket-dimension/planning-artifacts/architecture-dashboard.md` — tests-catalog, layout `tests`, Tree prefixes, FR-16]  
- [Source: `_bmad-output/pocket-dimension/planning-artifacts/prds/prd-dashboard-2026-08-23/prd.md` — FR-16, UJ-7, §6.3 test runner deferred]  
- [Source: `ux-designs/ux-dashboard-2026-08-23/EXPERIENCE.md` — Flow 7, UX-DR13, “No tests found.”]  
- [Source: implementation-artifacts `4-1-search-artifact-content-and-open-a-hit.md` — deferred tests field + Test Search group]

### Story completion status

ready-for-dev — Ultimate context engine analysis completed; comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Implemented `loadTestsCatalog()` scanning `apps/**` only (never `_bmad-output`); layout payload includes repo-wide `tests`.
- Tree prefix join via `filterTestsForTree`; Tests list + read-only source route; Search corpus appends `kind: "test"` entries.
- Empty state uses literal UX-DR13 copy: "No tests found." No Run button, no Sample World, no MiniSearch.
- Verified: `bun test src` (140 pass), `bun run check` (0 errors).

### File List

- apps/dashboard/src/lib/types.ts
- apps/dashboard/src/lib/experience-copy.ts
- apps/dashboard/src/lib/experience-copy.test.ts
- apps/dashboard/src/lib/catalog/filter-tests.ts
- apps/dashboard/src/lib/catalog/filter-tests.test.ts
- apps/dashboard/src/lib/server/tests-catalog.ts
- apps/dashboard/src/lib/server/tests-catalog.test.ts
- apps/dashboard/src/lib/server/load-search-corpus.ts
- apps/dashboard/src/lib/components/test-row.svelte
- apps/dashboard/src/routes/+layout.server.ts
- apps/dashboard/src/routes/tests/+page.svelte
- apps/dashboard/src/routes/tests/[...path]/+page.server.ts
- apps/dashboard/src/routes/tests/[...path]/+page.svelte
- _bmad-output/pocket-dimension/implementation-artifacts/sprint-status-dashboard.yaml

## Change Log

- 2026-08-23: Story 4.2 context created — Tests catalog from `apps/**`, tree prefix filter, open source, no runner.
- 2026-08-23: Story 4.2 implemented — on-disk test catalog, tree filter, source viewer, Search Test group.

## HALT / Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Scanning `_bmad-output` or seeding Sample World | **HALT** | `apps/` realpath only; empty → `[]` + “No tests found.” |
| Adding Run / invoking bun|vitest from UI | **HALT** | Catalog-only; deferred-work § test runner |
| Path traversal on open-source route | **HALT** | realpath must stay under `apps/`; else error DTO |
| `fs` inside `$lib/catalog` or BMAD classifier reuse | High | Reader only in `tests-catalog.ts`; pure filter elsewhere |
| Wrong empty copy (`No Tests in this Tree.`) | AC fail | Literal `No tests found.` via experience-copy |
| Marking `epic-4` done on story-file creation | Process error | Leave `epic-4: in-progress` until 4.2 implementation done |
| “Fixing” Search so pocket-dimension narrow = full test catalog | Scope / confusion | Document asymmetry; do not expand Search product |
| MiniSearch or second search stack | Out of scope | Append `kind: "test"` to existing corpus only |
| Related Story invented via BMAD crawl | Honesty fail | `relatedStoryHref` null unless real link exists |

No document blockers — proceed to `dev-story`.
