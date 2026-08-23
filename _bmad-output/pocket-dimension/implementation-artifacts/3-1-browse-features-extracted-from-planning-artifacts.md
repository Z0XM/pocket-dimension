---
story_id: "3.1"
story_key: 3-1-browse-features-extracted-from-planning-artifacts
epic: 3
depends_on: 2-4-show-honest-empty-and-missing-states-including-dashboards-own-files
baseline_commit: 0f95ac8
---

# Story 3.1: Browse Features extracted from planning Artifacts

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->
<!-- Validation skipped per create-story invocation (skip validate-story workflow). -->

## Story

As Ubuntu,
I want a Features list for the selected Tree,
so that I can see product shape without opening each PRD by path.

## Acceptance Criteria

1. **Given** the selected Tree has PRDs or equivalent planning Artifacts with Feature/FR sections  
   **When** I open Features  
   **Then** those Features and FR identifiers appear on the Features surface (FR-13, FR-9)  
   **And** each Feature row shows Feature/FR id, name, and source Artifact (UX-DR8)  
   **And** Features are extracted from planning Artifacts only — no second Feature database, no invented Features  
   **And** Feature remains a surface/extraction, not an `ArtifactKind`

2. **Given** I select a Feature  
   **When** it opens  
   **Then** the defining Artifact opens in the Reader (at that Artifact; heading jump if the id is in the document)

3. **Given** a Tree with no Feature/FR sections  
   **When** I open Features  
   **Then** I see “No Features in this Tree.” (or equivalent empty copy), not a blank page and not Sample World

4. **Given** I type in the Features filter  
   **When** text matches id or name  
   **Then** the list narrows; no match shows an empty list, not fake Features

## Tasks / Subtasks

- [x] Shared heading slug (hash jump must match Reader) (AC: 2)  
  - [x] **NEW** `apps/dashboard/src/lib/catalog/heading-slug.ts` — export exact `slugifyHeading(text: string): string` algorithm currently private in `markdown.ts` (trim → lower → spaces to `-` → strip non `[a-z0-9-]` → collapse `-` → trim edges).  
  - [x] **UPDATE** `apps/dashboard/src/lib/server/markdown.ts` — import and use shared `slugifyHeading` (behavior must stay identical; existing markdown heading-id tests must stay green).  
  - [x] Features extractor uses the **same** function for `headingSlug` so `/docs/...?tree=#${headingSlug}` lands on the Reader `id`.

- [x] Pure Features extractor in `$lib/catalog` (AC: 1, 3, 4)  
  - [x] **NEW** `apps/dashboard/src/lib/catalog/features.ts` — pure: `(markdown: string, meta: { sourcePath: string; sourceTitle: string }) => FeatureRow[]`. **No `fs`.**  
  - [x] **NEW** `apps/dashboard/src/lib/types.ts` (or co-located type) — `FeatureRow`:

    ```ts
    export type FeatureRow = {
      id: string;           // display id: "FR-1" | "FR-G0-1" | "4.1" | etc.
      name: string;         // heading title without the id token
      sourcePath: string;   // tree-relative path of the defining markdown file
      sourceTitle: string;  // Artifact title for the row meta (UX-DR8 source Artifact)
      headingSlug: string;  // slugifyHeading(full heading text) — must match Reader
      kind: "fr" | "feature";
    };
    ```

  - [x] **Extraction rules (exhaustive against live PRDs — do not invent rows):**

    | Pattern | Live examples | Row |
    | --- | --- | --- |
    | ATX heading `#{2,6}` whose text starts with `FR-…` | `#### FR-1: Discover BMAD Trees`; `#### FR-1 Access model`; `#### FR-3a Room creation role gate`; `#### FR-G0-1 Authentication required to join`; `#### FR-GM-10 Auto-split teams` | `kind: "fr"`; `id` = matched token (`FR-1`, `FR-3a`, `FR-G0-1`, …); `name` = remainder after optional `:` / whitespace |
    | Numbered Feature section under a Features parent | `### 4.1 Catalog of BMAD Trees and Artifacts` (dashboard / chhan-chhan `## 4. Features`) | `kind: "feature"`; `id` = `4.1`; `name` = rest of title |
    | Thematic group under `## Functional Requirements` that is **not** FR/NFR/UJ/G-goal/persona | zeo/rhymes `### Authentication and access`, `### Reading and discovery` | `kind: "feature"`; `id` = stable slug or short label from heading text (same string used for display id); `name` = full heading text; **only** if at least one FR heading appears later before the next same-or-higher-level heading that ends the group — never emit orphan thematic headings with zero FR children in the document region |

  - [x] **Do not extract:** `## Non-Functional Requirements` / `### NFR-*`, `### UJ-*`, `### G1.` product goals, persona headings, epic/story headings, architecture FR *mentions* in prose, epics file FR cross-refs, UX/DESIGN copy.  
  - [x] **Planning Artifact scope for v1:** markdown bodies of Artifacts with `artifactKind === "prd"` **and** `sourcePath` ending in `.md`. Skip run-folder **directory** refs (no body). Skip `ux` / `architecture` / `epic` / `story` / `doc` / `unclassified` even if they mention `FR-`. Equivalent planning = PRD Kind only unless a future story widens it.  
  - [x] Same `FR-1` in two different PRD files → **two rows** (different `sourcePath`). Never merge into one invented registry.  
  - [x] Stable sort: by `sourcePath` asc, then document order (extractor preserves encounter order within a file; merge concatenates files sorted by path).  
  - [x] Unknown / no matching headings → `[]` (empty), never placeholder Features.

- [x] Golden fixtures + unit tests (AC: 1, 3, 4)  
  - [x] **NEW** `apps/dashboard/src/lib/catalog/features.test.ts` (+ tiny fixture strings under `fixtures/` if useful). Cover:  
    - dashboard-style: `## 4. Features` + `### 4.1 …` + `#### FR-1: …` → feature + fr rows  
    - zeo-style: `## Functional Requirements` + thematic `###` + `#### FR-1 Access model` / `FR-3a` → feature + fr  
    - prefixed ids: `FR-G0-1`, `FR-GM-10`  
    - chhan-style numbered Features + `FR-1:`  
    - empty / NFR-only / UJ-only markdown → `[]`  
    - `headingSlug` equals shared `slugifyHeading` on the full heading line text (lock to Reader)  
    - filter helper (if pure): match id/name case-insensitive; no match → `[]`  
  - [x] Assert Feature is **never** added to `ArtifactKind` union / `classifyArtifact` return values (regression).  
  - [x] Run: `cd apps/dashboard && bun test src`

- [x] Server load: read PRD bodies for selected Tree (AC: 1, 3, NFR-6)  
  - [x] **NEW** `apps/dashboard/src/routes/features/+page.server.ts` — use layout `tree` + `snapshot`; select `prd` + `*.md` artifacts; read file text via existing allow-list helpers (`resolveTreePath` + `realpath` containment, same spirit as `read-artifact` / `read-tree`). Prefer a small **NEW** `$lib/server/load-features.ts` (fs) that calls pure `extractFeatures` — do **not** put `fs` in `$lib/catalog`.  
  - [x] Read full markdown (or enough of the file) for heading scan — Features are often mid-file. On single-file read failure: `console.warn` with **relative** path + reason; **omit** that file; do not fail the page; do not invent Features.  
  - [x] Return flat DTO: `{ features: FeatureRow[] }` (plus tree from parent). Request-time only; no watcher; no cross-navigation cache (NFR-6). Do **not** stuff Features into layout snapshot yet (keeps Docs load lean); freshness is still per-navigation because Features load runs on Features navigation.  
  - [x] When `!tree` / empty snapshot / `snapshotError`: `features: []`.

- [x] Features surface UI (AC: 1–4, UX-DR8, UX-DR14)  
  - [x] **UPDATE** `apps/dashboard/src/routes/features/+page.svelte` — replace permanent stub.  
  - [x] **NEW** `apps/dashboard/src/lib/components/feature-row.svelte` (kebab-case) — shows **id**, **name**, **source Artifact** (`sourceTitle` and/or muted mono `sourcePath`). Active/hover: accent left hairline + surface, **not** filled violet block (UX-DR4 / match Docs Catalog).  
  - [x] Row is an `<a>` to Reader:

    ```
    /docs/{encodePathSegments(sourcePath)}?tree={tree}#{headingSlug}
    ```

    Reuse `encodePathSegments` from `$lib/docs-path`. **Do not** invent `/features/[id]`, `/epics/[id]`, or `/stories/[id]` in this story.  
  - [x] Text filter: controlled input; filter client-side on `id` **or** `name` (case-insensitive substring). Preserve `?tree=` on the page; filter does **not** need a URL param in v1.  
  - [x] Empty Tree / zero extracted Features: `HonestState` with title exactly `No Features in this Tree.` + short reason (add to `experience-copy.ts`). Prefer reuse of `honest-state.svelte`.  
  - [x] Filter with no matches: **empty list** (muted one-liner OK, e.g. none / blank list) — **not** the Tree-empty copy, **not** fake rows, **not** Sample World.  
  - [x] Page title: `dashboard · Features`. Keep `tree` context via existing layout/nav.

- [x] Experience copy (AC: 3)  
  - [x] **UPDATE** `apps/dashboard/src/lib/experience-copy.ts` — add `featuresEmpty: { title: "No Features in this Tree.", reason: "…" }` (literal EXPERIENCE voice; no Oops / marketing).  
  - [x] Extend `experience-copy.test.ts` if present.

- [x] Preserve Epic 1–2 contracts (regression)  
  - [x] Health `GET /health` → `{"status":"ok"}`; port **3011**; no auth/DB; no write APIs  
  - [x] `ArtifactKind` stays without `'feature'`; Docs Catalog Kind groups unchanged  
  - [x] Reader / sanitize / resolve-link / heading ids unchanged except shared slug import  
  - [x] Delivery / Tests remain stubs; **do not** implement Delivery board (3.3) or epic/story routes (3.2) beyond opening Reader via existing `/docs/[...path]`  
  - [x] Do **not** implement Search overlay Feature grouping (Epic 4)  
  - [x] Tracking file: only `sprint-status-dashboard.yaml` — never rhymes `sprint-status.yaml`  
  - [x] Do not edit `apps/pocket/**` or invent Sample World / seed Features under empty trees

- [x] Verify (AC: 1–4)  
  - [x] `cd apps/dashboard && bun test src`  
  - [x] `cd apps/dashboard && bun run check`  
  - [x] Manual `?tree=pocket-dimension` → Features lists dashboard PRD Feature sections + FR-1…FR-17; click opens Reader with hash jump to FR heading  
  - [x] Manual `?tree=zeo` → many FR-* rows from multiple PRDs (incl. FR-G0 / FR-GM); no invented rows  
  - [x] Manual `?tree=chhan-chhan` → Feature `4.x` + FR rows from multi-account PRD  
  - [x] Filter `FR-13` / nonsense query → narrow vs empty list  
  - [x] Confirm Docs still groups by Kind and Feature is not a Kind header  
  - [x] `curl -sS http://localhost:3011/health` still OK

## Dev Notes

### Scope boundary (critical)

| In scope | Out of scope (later) |
| --- | --- |
| Pure `features.ts` extract from PRD markdown | Delivery board / table / Timeline (3.3) |
| Features page list + text filter + honest empty | `/epics/[id]`, `/stories/[id]` (3.2) |
| Open defining Artifact via existing `/docs/[...path]?tree=#hash` | Search palette Feature group (Epic 4) |
| Shared heading slug with Reader | Features extracted from architecture/epics/UX |
| `feature-row.svelte` + experience copy | Second Feature database, write-back, Sample World, MiniSearch, watcher |

### Exhaustive current-state analysis (read before coding)

**Baseline tip `0f95ac8` (Epic 2 done; Features still stub).**

#### `/features` stub today

```svelte
<!-- apps/dashboard/src/routes/features/+page.svelte -->
<h1>Features</h1>
<p>No Features in this Tree.</p>
{#if data.tree}<p>Tree: {data.tree}</p>{/if}
```

- No `+page.server.ts`. Uses layout `LayoutTreeData` only.  
- Always shows empty copy even when PRDs contain dozens of FRs — **this story replaces that lie with extraction**.  
- Nav already links Overview → Features (`nav.ts`); chrome/tree switcher already scoped by `?tree=`.

#### Snapshot / Docs pipeline to reuse

| Piece | Path | Role for 3.1 |
| --- | --- | --- |
| Layout snapshot | `+layout.server.ts` → `loadTreeSnapshot` | Lists Artifacts; use to find `prd` + `.md` paths |
| Classifier | `catalog/classify.ts` | `prd` Kind; Feature must **never** become a Kind |
| Docs open URL | `docs-path.encodePathSegments` + `docs-catalog` | Same href shape for Feature rows |
| Reader + hash | `markdown.ts` heading ids + `markdown-reader.svelte` `onMount` scroll | Heading jump target |
| Honest empty | `honest-state.svelte`, `experience-copy.ts` | Features empty state |
| Run-folder | directory + nested `prd.md` both in snapshot | Extract from **`prd.md` file**, open that path (hash works on rendered markdown) |

#### Live PRD heading patterns (must drive fixtures)

| Tree | Artifact | Shape |
| --- | --- | --- |
| pocket-dimension | `prds/prd-dashboard-2026-08-23/prd.md` | `## 4. Features` → `### 4.N Title` → `#### FR-N: Name` (17 FRs) |
| pocket-dimension | `prds/prd-rhymes-revamp-2026-06-20/prd.md` | `## Functional Requirements` → thematic `###` → `#### FR-N Name` / `FR-8a` |
| zeo | `prd-zeo-2026-06-27/prd.md` etc. | Same FR + thematic groups; game-mode uses `FR-G0-*`, `FR-GM-*`, `FR-CH-*` |
| chhan-chhan | `prd-chhan-multi-account-…/prd.md` | `## 4. Features` → `### 4.N` → `#### FR-N: Name` |

Slug examples (must match Reader): `FR-1: Discover BMAD Trees` → `fr-1-discover-bmad-trees`; `FR-3a Room creation role gate` → `fr-3a-room-creation-role-gate`.

#### Architecture compliance

- Feature is a **surface/extraction**, not `ArtifactKind` — [Source: architecture-dashboard.md Critical Gap #4; epics ArtifactKind union; Story 2.1]  
- Ignore stale Naming Patterns line that lists `'feature'` in Kind — **canonical union has no `'feature'`**  
- Modules: `catalog/features.ts` + `routes/features/` + `feature-row.svelte` — [Source: architecture project tree / FR mapping]  
- `$lib/catalog` pure; `$lib/server` fs only  
- Empty classified set → `No Features in this Tree.` — never Sample World  
- NFR-6 freshness: request-time load; no watcher  
- NFR-7 read-only: no Feature DB, no write-back

#### UX compliance

- UX-DR8 Feature row: id, name, source Artifact; click → Reader; text filter  
- UX-DR14 empty: `No Features in this Tree.`  
- EXPERIENCE Flow 5: Features → FR list → open → Reader shows defining PRD section  
- Active row: surface + accent hairline (UX-DR4)

### Project Structure Notes

```
apps/dashboard/src/
  lib/
    types.ts                         # UPDATE — FeatureRow
    experience-copy.ts               # UPDATE — featuresEmpty
    docs-path.ts                     # PRESERVE — encodePathSegments
    catalog/
      heading-slug.ts                # NEW — shared slugifyHeading
      features.ts                    # NEW — pure extract + optional filterFeatures
      features.test.ts               # NEW
      classify.ts                    # PRESERVE — still no 'feature' Kind
    server/
      markdown.ts                    # UPDATE — import shared slug
      load-features.ts               # NEW (optional) — fs + extract for tree
    components/
      feature-row.svelte             # NEW
      honest-state.svelte            # REUSE
  routes/
    features/+page.svelte            # UPDATE — real surface
    features/+page.server.ts         # NEW
    docs/[...path]/                 # PRESERVE — open target only
```

Conflict note: rhymes implementation-artifacts include unrelated `2-*` / other apps’ stories — **this** file is dashboard-only. Track only `sprint-status-dashboard.yaml`.

Conflict note: Do **not** mark epic-3 stories 3.2/3.3 ready; only flip `epic-3` → `in-progress` and `3-1-…` → `ready-for-dev`.

### Previous story intelligence (Epic 2)

- **2.1:** Catalog Kind groups; Feature explicitly not a Kind; `FEATURE_LIKE_PATHS` fixtures prove path names ≠ Kind  
- **2.2:** Sanitized Reader + heading ids + run-folder primary `prd.md`  
- **2.3:** resolve-link preserves `#hash` on Reader URLs  
- **2.4:** `honest-state` + `experience-copy`; Features stub left for Epic 3; `snapshotError` wired  
- Do not reopen classify rules, Catalog encoding, or sanitize order  
- Prefer extending experience-copy over inventing soft empty strings in the route

### Git intelligence

Recent on `cursor/dashboard-epic-1-66a2`:

- `0f95ac8` — realpath-contain catalog walk (Docs escape fix)  
- `2df08a9` — story 2.4 honest empty / unreadable  
- `f07d9d2` — story 2.3 resolve-link + hash preserve  
- `d4646b9` — story 2.2 Reader + heading ids  

Implement atop Epic 2; first Epic 3 story.

### Latest tech information

- Stack unchanged: Svelte 5 runes (`$props` / `$derived`), SvelteKit 2 loads, Bun, `bun:test`, Tailwind 4 tokens already in `app.css`  
- No new markdown libs; heading parse can be line-based ATX regex (no need for remark in the extractor)  
- Filter: plain `<input>` + `$state` / `$derived` — no command palette dependency  
- Hash scroll already implemented in `markdown-reader.svelte`; ensure navigation to Features→Docs with hash triggers mount scroll (full navigation is fine; soft SPA nav also remounts Reader)

### Testing requirements

Automated:

```bash
cd apps/dashboard
bun test src
bun run check
```

Manual (required evidence for done):

1. `pocket-dimension` Features shows dashboard Feature `4.x` + FR rows; open `FR-13` → Docs Reader scrolled to that heading  
2. `zeo` shows extracted FRs from multiple PRDs; empty filter miss does not invent rows  
3. Docs Catalog Kind headers still exclude Feature  
4. `/health` OK  

### Project context reference

- App: `apps/dashboard`, port **3011**, standalone (no auth/DB)  
- BMAD trees: `pocket-dimension`, `zeo`, `chhan-chhan` under `_bmad-output/`  
- Dashboard tracking: `sprint-status-dashboard.yaml` only  

### References

- [Source: epics-dashboard.md — Epic 3 / Story 3.1]  
- [Source: prd-dashboard-2026-08-23/prd.md — FR-9, FR-13, §4 Features]  
- [Source: architecture-dashboard.md — features.ts, Feature ≠ Kind, freshness, error copy]  
- [Source: ux-dashboard-2026-08-23/EXPERIENCE.md — Feature row, Flow 5, empty copy]  
- [Source: ux-dashboard-2026-08-23 — UX-DR8, UX-DR14]  
- [Source: apps/dashboard routes/features, catalog/classify, server/markdown, components/markdown-reader]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Shared `slugifyHeading` in `$lib/catalog/heading-slug.ts`; markdown Reader imports it unchanged.
- Pure `extractFeatures` / `filterFeatures` in `$lib/catalog/features.ts` with golden fixtures for dashboard, zeo, chhan-chhan PRD shapes.
- Server `loadFeaturesForTree` reads PRD `.md` bodies at request time; omits unreadable files with warn.
- Features page: list + filter + honest empty; rows link to `/docs/...?tree=#headingSlug`.
- Live extraction: pocket-dimension 62, zeo 163, chhan-chhan 14 Feature/FR rows.
- `bun test src` (81 pass) and `bun run check` (0 errors).

### File List

- apps/dashboard/src/lib/catalog/heading-slug.ts (new)
- apps/dashboard/src/lib/catalog/features.ts (new)
- apps/dashboard/src/lib/catalog/features.test.ts (new)
- apps/dashboard/src/lib/server/load-features.ts (new)
- apps/dashboard/src/lib/server/markdown.ts (updated)
- apps/dashboard/src/lib/types.ts (updated)
- apps/dashboard/src/lib/experience-copy.ts (updated)
- apps/dashboard/src/lib/experience-copy.test.ts (updated)
- apps/dashboard/src/lib/components/feature-row.svelte (new)
- apps/dashboard/src/routes/features/+page.server.ts (new)
- apps/dashboard/src/routes/features/+page.svelte (updated)
- _bmad-output/pocket-dimension/implementation-artifacts/sprint-status-dashboard.yaml (updated)
- _bmad-output/pocket-dimension/implementation-artifacts/3-1-browse-features-extracted-from-planning-artifacts.md (updated)

## Change Log

- 2026-08-23: Story 3.1 — Features extraction from PRD planning artifacts, Features surface UI, shared heading slug.

## Story Completion Status

Status: **done**

Features list extracts FR and numbered/thematic Feature rows from PRD markdown only; Feature is not an ArtifactKind; tests and typecheck pass.
