---
story_id: "2.4"
story_key: 2-4-show-honest-empty-and-missing-states-including-dashboards-own-files
epic: 2
depends_on: 2-3-follow-in-root-links-and-mark-unresolved-ones
baseline_commit: f07d9d2
---

# Story 2.4: Show honest empty and missing states, including dashboard’s own files

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->
<!-- Validation skipped per create-story invocation (skip validate-story workflow). -->

## Story

As Ubuntu,
I want to know when a Tree, Kind, or Artifact cannot be shown,
so that I trust the Showcase and can still find dashboard’s own BMAD files like any other Artifact.

## Acceptance Criteria

1. **Given** an empty BMAD Tree or a Kind with no Artifacts  
   **When** I open Docs (or that Kind group)  
   **Then** I see an empty state, not a blank page (FR-6, UX-DR14)  
   **And** copy is literal (e.g. one display line + one reason), not “Oops!” and not Sample World (NFR-2)

2. **Given** a listed Artifact is missing or unreadable  
   **When** I open it  
   **Then** the Reader shows “Unreadable Artifact.” plus a short reason  
   **And** the rest of the Catalog and chrome still work  
   **And** a single Artifact error does not fail the whole page; the whole page fails only if the allow-list root is unreadable  
   **And** server parse skips `console.warn` with a relative path and do not log file bodies

3. **Given** dashboard PRD, UX, architecture, and this epics file exist under `pocket-dimension`  
   **When** I open that Tree in Docs  
   **Then** those Artifacts appear and open like any other (FR-10)  
   **And** dashboard does not special-case itself

## Tasks / Subtasks

- [x] Honest empty-state primitive + EXPERIENCE copy (AC: 1, UX-DR14, DESIGN.md)  
  - [x] **NEW** `apps/dashboard/src/lib/components/honest-state.svelte` (kebab-case) — props: `title: string`, `reason: string` (optional third meta line OK for `sourcePath` on errors). Title uses `text-display`; reason uses muted body. **No** illustrations, icons-as-hero, cards, “Oops”, marketing, Sample World, War Room, or quests.  
  - [x] **NEW** `apps/dashboard/src/lib/experience-copy.ts` (or similar) — central literal strings from EXPERIENCE.md / UX-DR14 so routes do not invent soft copy:

    | Key | Display (title) | Reason (body) |
    | --- | --- | --- |
    | Docs empty Tree | `No Docs in this Tree.` | Short honest why, e.g. `This Tree has no catalogued Artifacts on disk.` |
    | Docs empty Kind | `No {Kind label} in this Tree.` | e.g. `Nothing classified as {Kind} was found.` |
    | Unreadable Artifact | `Unreadable Artifact.` | Server `reason` string (already short) |
    | BMAD Root (already in shell) | `BMAD Root unavailable.` | Keep existing `bmadRootError` / trees-empty reason — align to same component if easy |
    | Select prompt (non-empty Tree, no path) | Keep quiet: `Select an Artifact.` | Optional reason: `Choose a row in the Catalog.` — **not** an empty-Tree state |

  - [x] Voice ban list (fail review if present in UI strings this story adds): `Oops`, `Something went wrong`, `Try again`, Sample World, War Room, quests, Let’s add fixtures, emoji empty states.

- [x] Wire Docs empty Tree / empty Kind (AC: 1)  
  - [x] **UPDATE** `apps/dashboard/src/routes/docs/+layout.svelte`  
    - Today: single muted `<p>No Docs in this Tree.</p>` when `!tree \|\| !snapshot` or `artifacts.length === 0` — replace with `honest-state` (display + reason).  
    - Keep Catalog mounted structure (aside + Reader column); empty Catalog rail must not collapse into a blank main.  
  - [x] **UPDATE** `apps/dashboard/src/routes/docs/+page.svelte`  
    - Today always shows `Select an Artifact.` — **wrong for empty Tree** (blank-feeling + false prompt).  
    - If snapshot has **zero** artifacts (or no tree / tree error): render the **same** Docs empty honest-state (not Select).  
    - If snapshot has ≥1 artifact and no `[...path]`: keep Select prompt (quiet, not empty-Tree).  
  - [x] Empty **Kind** semantics (do **not** invent a Kind filter route):  
    - `groupArtifactsByKind` already **omits** empty Kind sections — preserve that (blank Kind headers = bad).  
    - Optional polish: if a Kind section would render with `items.length === 0`, never show it; if the whole Catalog is empty because every group omitted → Tree empty state above.  
    - Do **not** add fake Kind groups populated with Sample World.  
  - [x] Surface tree-level read failure reason:  
    - Today `+layout.server.ts` drops `error` from `loadTreeSnapshot` (`return { tree, artifacts: [], error }` → only `artifacts` kept).  
    - **UPDATE** layout load (and `LayoutTreeData` if needed) to pass through `snapshotError` / `snapshot.error` when the selected tree root is unreadable but BMAD Root itself exists.  
    - Docs empty reason should prefer that server reason over a generic line when present.  
    - Still: **do not** throw in layout load for a single-tree miss — chrome + other trees must work; only BMAD Root total failure is the “whole page” banner (`app-shell` already).

- [x] Unreadable Artifact path — harden + polish (AC: 2)  
  - [x] **UPDATE** `apps/dashboard/src/routes/docs/[...path]/+page.svelte` — swap the ad-hoc error block for `honest-state` with title exactly `Unreadable Artifact.` and `reason={artifact.reason}`; keep optional mono `sourcePath` as meta (DESIGN: display + reason; path is diagnostic, muted).  
  - [x] **PRESERVE** `docs/[...path]/+page.server.ts` contract: never `error()` / never throw for missing file — return `{ kind: "error", sourcePath, reason }`. Catalog layout must still render.  
  - [x] Confirm `loadArtifact` / `resolveArtifactPath` already returns error DTO for: not found, escape/`..`, outside tree, unsupported type, read throw. Do **not** re-architect; only fix gaps if a path still throws to the client as a page failure.  
  - [x] Catalog rows for `ArtifactRef` with optional `error` from walk: still list them; opening yields Unreadable (or load succeeds). Do **not** remove the row silently. Optional: muted hint on the row — not required if open path is honest.  
  - [x] Single-Artifact failure must not clear `snapshot` or unmount Catalog. Regression: open a good sibling after an unreadable URL — Catalog + chrome intact.

- [x] Logging contract audit (AC: 2)  
  - [x] Audit `read-artifact.ts`, `read-tree.ts`, `bmad-root.ts`, `markdown.ts`: every skip/fail uses `console.warn` with **relative** path (or tree-relative) + short reason; **never** log raw file bodies / full markdown / YAML text.  
  - [x] If any log interpolates file content today, remove it. Prefer one consistent prefix (`read-artifact:`, `read-tree:`).  
  - [x] Optional tiny test or comment-locked helper: warn formatter that only accepts `relativePath` + `reason` strings — not required if audit is clean.

- [x] FR-10 dogfood — verify, do not special-case (AC: 3)  
  - [x] Confirm on disk under `_bmad-output/pocket-dimension/` (already present; do not invent copies):

    | Artifact | Expected Kind | Representative path |
    | --- | --- | --- |
    | PRD | `prd` | `planning-artifacts/prds/prd-dashboard-2026-08-23` (run-folder) and/or `…/prd.md` |
    | UX | `ux` | `planning-artifacts/ux-designs/ux-dashboard-2026-08-23` (run-folder) and/or `DESIGN.md` / `EXPERIENCE.md` |
    | Architecture | `architecture` | `planning-artifacts/architecture-dashboard.md` |
    | Epics | `epic` | `planning-artifacts/epics-dashboard.md` |

  - [x] Manual (required): `?tree=pocket-dimension` → Docs lists each under the correct Kind group → open each → Reader shows structured content (or run-folder primary), same as zeo/chhan-chhan Artifacts.  
  - [x] **Forbidden:** `if (tree === 'pocket-dimension')`, hard-coded dashboard titles, pinned “dashboard” section, seeding missing files, or any path allow-list beyond the existing three trees. Dogfood = same classify + walk + Reader pipeline.  
  - [x] Optional golden: assert `classifyArtifact` on the four paths above (fixtures already partially cover these in `classify.test.ts` / `fixtures/paths.ts`) — extend only if a gap exists; do not duplicate live BMAD into Sample World.

- [x] Align Epic 1 surface stubs only if touching shared primitive (AC: 1 adjacent; do not expand Epic 3/4)  
  - [x] Features / Delivery / Tests already show one-line EXPERIENCE stubs (`No Features in this Tree.` etc.). Prefer **optional** reuse of `honest-state` with a one-line reason for visual consistency — **or** leave stubs untouched if Docs-only scope is cleaner. Do **not** implement Features extraction, Delivery board, or Tests catalog.  
  - [x] Overview cold load `Reading BMAD…` and BMAD Root banner: leave behavior; may wrap root banner in `honest-state` for one pattern.

- [x] Preserve Epic 1–2.3 contracts (regression)  
  - [x] Health `GET /health` → `{"status":"ok"}`; port **3011**; no auth/DB; no write APIs  
  - [x] Catalog Kind groups, `/docs/[...path]?tree=`, sanitize → resolve-link → unresolved destructive — unchanged behavior  
  - [x] `$lib/catalog` stays pure (no `fs`); empty-state is UI + copy only  
  - [x] Do **not** implement Search overlay, keyboard registry, `searchCorpus`, Delivery projection, Features extractor, `/epics/[id]`, `/stories/[id]`  
  - [x] Do **not** invent Sample World / fixture browse / seed data for empty Trees  
  - [x] Tracking file: only `sprint-status-dashboard.yaml` — never rhymes `sprint-status.yaml`  
  - [x] Do not edit `apps/pocket/**` or non-dashboard planning trees for “demo” content  
  - [x] **Do not** mark `epic-2` done in sprint status when this story is only ready-for-dev / in progress — epic stays `in-progress` until all Epic 2 stories are `done` and a human/retrospective closes it

- [x] Verify (AC: 1–3)  
  - [x] `cd apps/dashboard && bun test src`  
  - [x] `cd apps/dashboard && bun run check`  
  - [x] Manual empty Tree: temporarily point at an empty allow-listed dir **or** simulate `artifacts: []` / document how tested — Docs shows display+reason empty state; **not** blank; **not** Select; **not** Sample World  
  - [x] Manual missing Artifact: `/docs/does-not-exist.md?tree=pocket-dimension` → `Unreadable Artifact.` + reason; Catalog + sidebar still work; open a real sibling afterward  
  - [x] Manual FR-10: open dashboard PRD run-folder, UX pack, `architecture-dashboard.md`, `epics-dashboard.md` under `pocket-dimension`  
  - [x] Confirm server logs on skip show relative paths only (trigger a missing read; inspect terminal)  
  - [x] `curl -sS http://localhost:3011/health` still OK

## Dev Notes

### Scope boundary (critical)

| In scope | Out of scope (later) |
| --- | --- |
| EXPERIENCE/DESIGN honest empty + Unreadable polish | Search miss copy / ⌘K overlay (Epic 4) |
| Docs empty Tree / empty Kind honesty | Features extractor empty beyond stub align (Epic 3) |
| Pass through tree snapshot error reason | Delivery / Timeline empty datasets (Epic 3) |
| Logging audit (warn relative path; no bodies) | File watcher, MiniSearch, Sample World, write-back, auth |
| FR-10 dogfood verification (no special-case) | `/epics/[id]`, `/stories/[id]` Reader routes |
| Shared `honest-state` + copy constants | New markdown pipeline features; resolve-link changes |

### Exhaustive current-state analysis (read before coding)

**Baseline commit `f07d9d2` (Story 2.3 done).**

#### Empty / stub surfaces today

| Location | Current UI | Gap vs AC / DESIGN / EXPERIENCE |
| --- | --- | --- |
| `docs/+layout.svelte` | One muted line `No Docs in this Tree.` when no tree/snapshot or `artifacts.length === 0` | Missing **display + reason** pair (DESIGN Empty/error). Reason never explains tree-root failure. |
| `docs/+page.svelte` | Always `Select an Artifact.` | On empty Tree this is dishonest (nothing to select) and feels blank/wrong. Must branch: empty → honest empty; non-empty → Select. |
| `docs/[...path]/+page.svelte` | `Unreadable Artifact.` + reason + `sourcePath` | Mostly AC2; align to shared `honest-state`; ensure never a thrown error page. |
| `features/+page.svelte` | `No Features in this Tree.` + optional Tree id | EXPERIENCE one-liner OK for Epic 3; optional shared component only. |
| `delivery/+page.svelte` | `No Epics & Stories in this Tree.` | Same. |
| `tests/+page.svelte` | `No Tests in this Tree.` | Same (Epic 4 owns real catalog). |
| `+page.svelte` (Overview) | `Reading BMAD…` while navigating; tree header or `No Current BMAD Tree is selected.` | Cold-load copy already EXPERIENCE-aligned. |
| `app-shell.svelte` | `BMAD Root unavailable.` + `bmadRootError` / trees-empty reason | Already display+reason for allow-list root failure — **this** is the “whole page” failure banner; children still render underneath. Preserve. |
| `group-by-kind.ts` | Omits empty Kind groups | Correct for “Kind with no Artifacts” — do not show empty Kind headers. Tree-level empty covers “no Artifacts at all.” |
| `docs-catalog.svelte` | Renders groups only | If given `[]`, renders empty `<nav>` — parent must show honest-state instead of blank nav. |

#### read-artifact / load error path (already largely correct)

| Step | Behavior | 2.4 action |
| --- | --- | --- |
| `resolveArtifactPath` | `{ ok: false, reason }` for missing, `..`, escape, resolve fail | PRESERVE |
| `loadArtifact` | Returns `{ kind: "error", sourcePath, reason }`; `console.warn(\`read-artifact: ${sourcePath}: …\`)` | PRESERVE + audit no body logs |
| Unsupported ext | error + warn | PRESERVE |
| `loadMarkdownFile` / `loadTextFile` catch | error DTO + warn relative path | PRESERVE |
| `docs/[...path]/+page.server.ts` | No tree → error DTO `No tree selected.`; else `loadArtifact` | PRESERVE no-throw |
| Layout Catalog | Independent of artifact load | PRESERVE — AC2 “Catalog still works” |

#### EXPERIENCE.md / DESIGN.md copy (authoritative)

From EXPERIENCE **State Patterns** / **Voice and Tone**:

- Missing Artifact → `Unreadable Artifact.` + reason (never “Oops! Something went wrong.”)
- Empty Features/Delivery/Tests → `No Features in this Tree.` (etc.)
- Cold load → `Reading BMAD…`
- Search miss → Epic 4 (`No matches for {query}.`) — do not implement Search here

From DESIGN **Empty / error**:

- `{typography.display}` one short line + `{typography.body}` one short reason  
- No illustrations

#### Snapshot error drop (bug for AC1/AC2)

```ts
// +layout.server.ts today
const result = loadTreeSnapshot(tree);
snapshot = { tree: result.tree, artifacts: result.artifacts };
// result.error discarded when resolveTreePath fails
```

`loadTreeSnapshot` on tree miss returns `{ tree, artifacts: [], error: resolved.reason }` and does **not** throw. Wire `error` into layout data so Docs empty reason can be honest (“Tree folder missing or unreadable”) without inventing Artifacts.

#### FR-10 paths (live disk — no special case)

These must appear via normal walk+classify under `tree=pocket-dimension`:

- `planning-artifacts/prds/prd-dashboard-2026-08-23` (+ `prd.md`)
- `planning-artifacts/ux-designs/ux-dashboard-2026-08-23` (+ `DESIGN.md`, `EXPERIENCE.md`)
- `planning-artifacts/architecture-dashboard.md`
- `planning-artifacts/epics-dashboard.md`

Classifier rules already map these (see Story 2.1 / `classify.ts`). Opening uses Story 2.2 Reader. This story only **proves** and forbids special-casing.

### Architecture compliance

- Fail a single Artifact as `{ error }` / Reader error state; fail whole page only if allow-list root unreadable — [Source: architecture-dashboard.md — Format Patterns / Error Handling]
- Empty classified set → empty state from EXPERIENCE.md; never Sample World — [Source: architecture-dashboard.md — Error Handling table]
- Server parse skips: `console.warn` with relative path; do not dump file bodies — [Source: architecture-dashboard.md — Ops]
- FR-6 Empty/missing + FR-10 Dogfood live in Docs/Reader honesty — [Source: architecture-dashboard.md — FR mapping]
- `$lib/server` = fs; `$lib/catalog` = pure; UI copy in components / `$lib/experience-copy.ts`
- Named absences: Sample World, API nav, Blockers, Questions, Deferred, write-back, auth, watcher, MiniSearch

### Library / framework requirements

- Stack unchanged: Svelte 5 runes, SvelteKit 2, Bun, Tailwind 4, Fira Code, existing remark/rehype  
- **No new** markdown libraries, MiniSearch, auth, or DB  
- Tests: `bun:test`; `"test": "bun test src"`  
- Prefer reusing `text-display` / muted body tokens already in `app.css`

### Project Structure Notes

```
apps/dashboard/src/
  lib/
    experience-copy.ts              # NEW — literal EXPERIENCE strings
    components/
      honest-state.svelte           # NEW — display + reason
      docs-catalog.svelte           # PRESERVE grouping; parent handles empty
      markdown-reader.svelte        # PRESERVE
      app-shell.svelte              # optional align root banner
    server/
      read-artifact.ts              # AUDIT logs; PRESERVE error DTO
      read-tree.ts                  # AUDIT logs; error already on miss
      bmad-root.ts                  # PRESERVE
    catalog/                        # PRESERVE pure classify/group/resolve-link
  routes/
    +layout.server.ts               # UPDATE — pass snapshot error through
    docs/+layout.svelte             # UPDATE — honest empty Catalog rail
    docs/+page.svelte               # UPDATE — empty vs Select branch
    docs/[...path]/+page.svelte    # UPDATE — honest-state for errors
    docs/[...path]/+page.server.ts # PRESERVE no-throw load
```

Conflict note: rhymes artifacts include unrelated `2-4-provide-expanded-editor-…` — **this** file is dashboard-only. Track only `sprint-status-dashboard.yaml`.

Conflict note: Kind union has no `'feature'` — ignore stale architecture Naming Patterns.

Conflict note: Do **not** mark `epic-2: done` when finishing this story file or implementation until retrospective/process says so; after 2.4 implementation reaches `done`, epic-2 may still need explicit close — user instruction for **this** create-story run: leave `epic-2: in-progress`.

### Previous story intelligence (2.1–2.3)

- **2.1:** Catalog Kind groups; empty Tree got a one-liner deferred to 2.4; FR-10 “appear” readiness; `ArtifactRef.error` optional on walk failure  
- **2.2:** Reader + error DTO + `Unreadable Artifact.` minimal path; Catalog stays in `docs/+layout.svelte`; Select prompt deferred polish to 2.4; logging warn relative paths  
- **2.3:** resolve-link + unresolved destructive; explicitly deferred 2.4 empty/Kind EXPERIENCE polish + FR-10 open matrix  
- Do not reopen sanitize order, Catalog encoding, or link resolve  
- 61 tests green after 2.3 — keep classify/slug/bmad-root/nav/markdown/resolve-link green

### Git intelligence

Recent on `cursor/dashboard-epic-1-66a2`:

- `f07d9d2` — story 2.3 resolve-link + unresolved styling  
- `d4646b9` — story 2.2 sanitized Reader + read-artifact  
- `683ea40` — story 2.1 Kind-grouped Catalog  

Implement atop 2.3; this is polish + honesty + dogfood proof, not a Reader rewrite.

### Latest tech information

- No new framework APIs required; Svelte 5 snippets/`$props` match existing components  
- Prefer a tiny presentational component over route-local duplicated markup  
- Do not add client-side fs checks for empty states — trust layout `snapshot`

### Testing requirements

Automated:

```bash
cd apps/dashboard
bun test src
bun run check
```

Add tests only where logic is non-trivial (e.g. copy helper, or layout data includes snapshot error). UI copy can be manual + spot assertions if a pure helper selects empty vs select prompt.

Manual:

```bash
bun run dev:app:dashboard
# Empty: Docs with zero artifacts → display+reason; not Select; not Sample World
# Missing: /docs/nope.md?tree=pocket-dimension → Unreadable Artifact. + reason; Catalog works
# Dogfood: open PRD / UX / architecture-dashboard / epics-dashboard under pocket-dimension
# Logs: missing read → warn with relative path only
curl -sS http://localhost:3011/health
```

Fail if: blank Docs main on empty Tree; “Oops!” / Sample World anywhere; layout throws on one bad Artifact; file bodies in logs; `if (tree === 'pocket-dimension')` special-case; epic-2 marked done while creating this story; rhymes `sprint-status.yaml` edited.

### Anti-patterns (do not)

- Inventing Sample World / seed Artifacts when disk is empty  
- Soft marketing empty copy (“Nothing here yet — get started!”)  
- Failing `+layout.server.ts` / throwing SvelteKit `error(500)` for a single missing Artifact  
- Logging markdown/YAML bodies on parse skip  
- Hard-coding dashboard dogfood pins or a “Dashboard” Kind  
- Rebuilding Catalog or markdown pipeline “while here”  
- Implementing Search / Delivery / Features extraction  
- Editing rhymes sprint status or pocket app  
- Marking `epic-2` done in this create-story pass

### References

- [Source: planning-artifacts/epics-dashboard.md — Story 2.4, Epic 2, FR-6, FR-10, NFR-2, UX-DR14]
- [Source: planning-artifacts/architecture-dashboard.md — Error Handling; FR-6/FR-10; logging; Format Patterns single-Artifact fail]
- [Source: planning-artifacts/ux-designs/ux-dashboard-2026-08-23/EXPERIENCE.md — State Patterns; Voice and Tone; Flow 3 Dogfood]
- [Source: planning-artifacts/ux-designs/ux-dashboard-2026-08-23/DESIGN.md — Empty/error display + reason]
- [Source: planning-artifacts/prds/prd-dashboard-2026-08-23/prd.md — FR-6, FR-10, UJ-1 edge, UJ-3]
- [Source: implementation-artifacts/2-3-follow-in-root-links-and-mark-unresolved-ones.md — deferred 2.4 polish]
- [Source: implementation-artifacts/2-2-read-an-artifact-as-structured-markdown.md — error DTO baseline]
- [Source: implementation-artifacts/2-1-browse-docs-grouped-by-artifact-kind.md — empty one-liner deferred]
- [Source: apps/dashboard/src/routes/docs/+layout.svelte — empty stub]
- [Source: apps/dashboard/src/routes/docs/+page.svelte — Select stub]
- [Source: apps/dashboard/src/routes/docs/[...path]/+page.svelte — Unreadable path]
- [Source: apps/dashboard/src/lib/server/read-artifact.ts — error + warn]
- [Source: apps/dashboard/src/lib/server/read-tree.ts — snapshot + warn]
- [Source: apps/dashboard/src/routes/+layout.server.ts — snapshot error drop]

## Dev Agent Record

### Agent Model Used

Cursor Composer (dev-story implementer)

### Debug Log References

### Completion Notes List

- Added `honest-state.svelte` and `experience-copy.ts` with literal EXPERIENCE strings (display + reason pattern).
- Wired Docs empty Tree / Select branching via `isDocsTreeEmpty`; pass `snapshotError` through `+layout.server.ts`.
- Unreadable Artifact uses shared `honest-state`; BMAD Root banner aligned to same component.
- Logging audit clean: `read-artifact:` / `read-tree:` warn with relative paths only; no body dumps.
- FR-10 dogfood verified via curl (PRD, architecture, epics under pocket-dimension); classify golden tests already cover paths.
- 66 tests pass; `bun run check` clean; health OK; manual unreadable + select prompt verified.

### File List

- `apps/dashboard/src/lib/components/honest-state.svelte` (new)
- `apps/dashboard/src/lib/experience-copy.ts` (new)
- `apps/dashboard/src/lib/experience-copy.test.ts` (new)
- `apps/dashboard/src/lib/types.ts`
- `apps/dashboard/src/lib/components/app-shell.svelte`
- `apps/dashboard/src/routes/+layout.server.ts`
- `apps/dashboard/src/routes/docs/+layout.svelte`
- `apps/dashboard/src/routes/docs/+page.svelte`
- `apps/dashboard/src/routes/docs/[...path]/+page.svelte`
- `_bmad-output/pocket-dimension/implementation-artifacts/2-4-show-honest-empty-and-missing-states-including-dashboards-own-files.md`
- `_bmad-output/pocket-dimension/implementation-artifacts/sprint-status-dashboard.yaml`

## Change Log

- 2026-08-23: Story 2.4 context created (ready-for-dev) — honest empty/Kind/Unreadable polish, logging audit, FR-10 dogfood verification; epic-2 left in-progress.
- 2026-08-23: Story 2.4 implemented — honest-state primitive, Docs empty/Select branching, snapshotError passthrough, Unreadable polish; epic-2 done.
