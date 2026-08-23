---
story_id: "3.3"
story_key: 3-3-walk-delivery-as-board-table-and-timeline
epic: 3
depends_on: 3-2-open-epics-and-stories-with-optional-status
baseline_commit: 4209090
---

# Story 3.3: Walk Delivery as board, table, and Timeline

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->
<!-- Validation skipped per create-story invocation (skip validate-story workflow). -->

## Story

As Ubuntu,
I want Epics and Stories on a Delivery board, a table, and a process Timeline,
so that I can see where work stands without writing status back to disk.

## Acceptance Criteria

1. **Given** Epic and Story Artifacts exist in the selected Tree  
   **When** I open Epics & Stories (`/delivery`)  
   **Then** one Delivery projection feeds board, table, and Timeline (FR-14, FR-15, UX-DR9)  
   **And** default view is **board**; chips switch Board / Table / Timeline  
   **And** URL `view` is `board` | `table` | `timeline`; `/timeline` redirects to `/delivery?view=timeline`  
   **And** selecting an Epic or Story opens that Artifact  
   **And** views do not re-parse status independently

2. **Given** status exists in `sprint-status.yaml` or a Story `Status:` line  
   **When** Delivery renders  
   **Then** precedence is (1) parseable `sprint-status.yaml`, (2) Story `Status:` line, (3) `unknown`  
   **And** code status is `'backlog' | 'in-progress' | 'done' | 'unknown'` plus `statusLabel` for the raw string  
   **And** extra sprint-status values map to `unknown` but keep the label  
   **And** missing sprint-status does not hide Epics or Stories that exist as files  
   **And** the UI never writes status to disk (no drag-to-change-status)

3. **Given** Timeline view  
   **When** I open it  
   **Then** Epics appear in document or process order with Stories under them (not a calendar)  
   **And** Epic milestones and Story nodes are openable  
   **And** status color is semantic, not decorative

4. **Given** a Tree with no Epics or Stories  
   **When** I open Delivery  
   **Then** I see “No Epics in this Tree.” (or equivalent), not a blank page and not Sample World

## Tasks / Subtasks

- [ ] Status mapping fix for Delivery board columns (AC: 2)  
  - [ ] **UPDATE** `apps/dashboard/src/lib/catalog/status.ts` `mapStatusLabel` so architecture union members map correctly for board columns:

    | Raw (case-insensitive) | `status` | Notes |
    | --- | --- | --- |
    | `backlog` | `backlog` | column |
    | `in-progress` | `in-progress` | column — **fix 3.2** which mapped this to `unknown` |
    | `done`, `complete`, `completed` | `done` | column |
    | `ready-for-dev`, `review`, `contexted`, `optional`, and any other string | `unknown` | keep raw `statusLabel` (architecture: extra sprint-status values → unknown + label) |

  - [ ] **UPDATE** `apps/dashboard/src/lib/catalog/status.test.ts` — `in-progress` → `{ status: "in-progress", statusLabel: "in-progress" }`; extras still `unknown` + label. Catalog/Reader continue to show raw `statusLabel` (no board there).  
  - [ ] Do **not** invent new board columns beyond `backlog` | `in-progress` | `done` | `unknown`.

- [ ] Sprint-status filename contract — no product fork (AC: 2)  
  - [ ] Architecture canon filename: **`sprint-status.yaml`** only.  
  - [ ] Locate under the selected Tree by snapshot Artifact whose **basename is exactly** `sprint-status.yaml` (typical path `implementation-artifacts/sprint-status.yaml`).  
  - [ ] **Do not** read `sprint-status-dashboard.yaml` (or any `sprint-status-*.yaml`) for Delivery status. That file is dashboard BMAD process tracking; classifier already treats `sprint-status*` basename prefix as Kind **doc** — it remains a Docs Artifact only.  
  - [ ] Live reality (do not special-case): pocket-dimension has both files; `sprint-status.yaml` currently tracks **rhymes**. Delivery still parses that basename when present — matching keys attach to Story files that share those keys; dashboard story files without a matching key fall through to `Status:` / `unknown`. Honesty over inventing a second status source.  
  - [ ] zeo has `implementation-artifacts/sprint-status.yaml` — primary happy path. chhan-chhan may have none — still list Epic/Story files.

- [ ] Pure Delivery projection (AC: 1, 2, 3, 4)  
  - [ ] **NEW** `apps/dashboard/src/lib/catalog/delivery.ts` — pure (no `fs`):

    ```ts
    export type DeliveryView = "board" | "table" | "timeline";

    export type DeliveryItem = {
      id: string;                 // ArtifactRef.id (slug)
      title: string;
      kind: "epic" | "story";
      sourcePath: string;
      status: StoryStatus;        // always set after resolve (default unknown)
      statusLabel: string;        // raw when known; "unknown" when none
      epicNumber: number | null;  // from story `N-M-*` or epic key/filename when parseable
    };

    /** Parse development_status map; null if missing/unparseable. Never invent keys. */
    export function parseSprintStatusYaml(text: string): Map<string, string> | null;

    /** Match sprint-status key → ArtifactRef (story stem or epic-N). */
    export function sprintStatusKeyForArtifact(artifact: Pick<ArtifactRef, "artifactKind" | "sourcePath">): string | null;

    /** Precedence: sprint map → Status: fields on ref → unknown. */
    export function resolveItemStatus(
      artifact: ArtifactRef,
      sprintMap: Map<string, string> | null
    ): { status: StoryStatus; statusLabel: string };

    /** One projection: epic + story Kind only; omit unclassified/docs/prd/…. */
    export function projectDelivery(
      artifacts: ArtifactRef[],
      sprintMap: Map<string, string> | null
    ): DeliveryItem[];

    export function parseDeliveryView(raw: string | null): DeliveryView; // default board; invalid → board
    ```

  - [ ] **Sprint key ↔ Artifact matching (exhaustive):**  
    - Story: basename stem (no `.md`) **equals** `development_status` key (e.g. `1-1-create-zeo-sveltekit-app-workspace`).  
    - Epic: key `epic-N` matches only when the epic Artifact basename clearly encodes that N (e.g. zeo `9-epic-remove-guest-mode.md` ↔ prefer story-style clarity; for `epic-9` key, match basename containing `-epic-` with leading number `9-` **or** explicit `epic-9` token). Pack files (`epics.md`, `epics-dashboard.md`) do **not** get a forged `epic-N` status from every epic-* key — leave pack status to `Status:` line if present, else unknown.  
    - Keys with no matching Artifact → **skip** (never invent Delivery rows).  
    - Retrospective keys (`epic-N-retrospective`) → ignore.  

  - [ ] **Status precedence per item:** (1) if sprint map has matching key and value is non-empty → `mapStatusLabel(value)`; (2) else if `artifact.status` / `statusLabel` already set from snapshot `Status:` line → use those; (3) else `{ status: "unknown", statusLabel: "unknown" }`.  
  - [ ] Missing or unparseable `sprint-status.yaml` → `sprintMap = null`; still project every epic/story Artifact (FR-15).  
  - [ ] **NEW** `apps/dashboard/src/lib/catalog/delivery.test.ts` — fixtures: precedence order; extra labels → unknown; missing yaml; orphan keys ignored; view parse defaults; no invented rows.

- [ ] Server load: read yaml once, project once (AC: 1, 2)  
  - [ ] **NEW** (or extend) `apps/dashboard/src/lib/server/load-delivery.ts` — given `tree` + snapshot:  
    1. Find `sprint-status.yaml` Artifact in snapshot (exact basename).  
    2. `readFileSync` via existing allow-list resolve (`resolveArtifactPath` / tree root) — same honesty as Features.  
    3. `parseSprintStatusYaml` with `Bun.YAML.parse` (available; **no new yaml dependency**). On throw/bad shape → `null`.  
    4. `projectDelivery(snapshot.artifacts, sprintMap)`.  
  - [ ] **NEW** `apps/dashboard/src/routes/delivery/+page.server.ts` — read `view` from `url.searchParams`; return `{ items, view }` from one projection. Invalid `view` → `board`. Preserve `tree` from parent.  
  - [ ] **UPDATE** `apps/dashboard/src/routes/delivery/+page.svelte` — replace stub; switch presentation only:

    ```svelte
    <!-- chips are links (or tabs) that set ?view= while preserving ?tree= -->
    {#if view === "board"}<DeliveryBoard … />{/if}
    {#if view === "table"}<DeliveryTable … />{/if}
    {#if view === "timeline"}<DeliveryTimeline … />{/if}
    ```

  - [ ] Empty: `items` with no epics **and** no stories → `HonestState` / copy **“No Epics in this Tree.”** via `EXPERIENCE_COPY` (add `deliveryEmpty`). Do not use the stub’s “No Epics & Stories…” soft string.  
  - [ ] Page title: `dashboard · Epics & Stories`.

- [ ] View chips + `/timeline` redirect (AC: 1)  
  - [ ] Chips: **Board** / **Table** / **Timeline** (UX-DR9). Active chip = current `view`. Use existing shadcn `tabs` **or** plain links with accent hairline — no decorative pill cluster.  
  - [ ] Chip hrefs: `/delivery?tree={tree}&view={board|table|timeline}` (omit `view` when board if desired; parse must still default board).  
  - [ ] **NEW** `apps/dashboard/src/routes/timeline/+page.server.ts` — `redirect(302|307, '/delivery?view=timeline' + preserve tree query if present)`.  
  - [ ] Refresh restores `tree` + `view` (URL truth).

- [ ] Presentation components — one dataset (AC: 1, 3)  
  - [ ] **NEW** `apps/dashboard/src/lib/components/delivery-board.svelte` — columns `backlog` | `in-progress` | `done` | `unknown` (order). Cards = `DeliveryItem`; click → `/epics/{id}?tree=` or `/stories/{id}?tree=` (reuse slug ids). Group visually by `epicNumber` when present (optional section labels); do **not** hide ungrouped items. **No drag**, no on-drop status change, no write API.  
  - [ ] **NEW** `apps/dashboard/src/lib/components/delivery-table.svelte` — same `items`; columns at least Title, Kind, Status (`statusLabel`), openable row/link. Prefer existing `$lib/components/ui/table`.  
  - [ ] **NEW** `apps/dashboard/src/lib/components/delivery-timeline.svelte` — vertical process rail (mockup `mockups/delivery.html`):  
    - Order groups by `epicNumber` ascending; items with `epicNumber === null` after numbered groups (or under “Other”), still listed.  
    - Within a group: epic Artifact(s) for that number first (openable), then stories sorted by story filename / title.  
    - When only pack epic files exist (`epics-dashboard.md`) and stories have numbers 1..N: still show process-ordered story groups; pack epic file is openable as the epic milestone for groups that share that pack (same `href` to that Artifact) — **do not** invent per-number epic files.  
    - Status affordance: muted/accent/destructive token by `status` union (semantic: done vs backlog vs unknown) — not rainbow decoration. DESIGN: accent for selection/focus; destructive only for errors; prefer muted + accent dot like mockup.  
  - [ ] Components receive `DeliveryItem[]` (+ `tree`); **zero** status re-parse inside components.

- [ ] UX-DR11 back via Delivery (AC: 1; completes 3.2 deferral)  
  - [ ] **UPDATE** `routes/epics/[id]/+page.svelte` and `routes/stories/[id]/+page.svelte` — primary back link to `sectionHref("/delivery", tree)` (“← Epics & Stories”); Docs link may remain secondary.  
  - [ ] Overview already links to Delivery — preserve.

- [ ] Types + experience copy (AC: 4)  
  - [ ] **UPDATE** `apps/dashboard/src/lib/types.ts` — export `DeliveryView`, `DeliveryItem` (or re-export from catalog).  
  - [ ] **UPDATE** `apps/dashboard/src/lib/experience-copy.ts` — `deliveryEmpty: { title: "No Epics in this Tree.", reason: "…" }`.  
  - [ ] **UPDATE** tests for experience-copy if present.

- [ ] Preserve contracts / out of scope  
  - [ ] Do **not** implement Search (4.1) or Tests catalog (4.2).  
  - [ ] Do **not** add write endpoints, drag-to-status, Sample World, or Blockers/Questions/Deferred nav.  
  - [ ] Features, Docs, `/epics`, `/stories`, health unchanged except back-link + status map fix.  
  - [ ] Track dashboard work only in `sprint-status-dashboard.yaml` — never overwrite rhymes `sprint-status.yaml`.  
  - [ ] No edits under `apps/pocket/**`.

- [ ] Verify (AC: 1–4)  
  - [ ] `cd apps/dashboard && bun test src`  
  - [ ] `cd apps/dashboard && bun run check`  
  - [ ] Manual `?tree=zeo`: `/delivery` board default; chips flip `view`; cards open `/stories/…` / `/epics/…`; Timeline process order; sprint-status statuses visible.  
  - [ ] Manual `?tree=pocket-dimension`: Epics/Stories list even when dashboard stories are absent from rhymes `sprint-status.yaml`; Status: line still applies; `sprint-status-dashboard.yaml` does **not** drive columns.  
  - [ ] Manual `?tree=chhan-chhan`: empty “No Epics in this Tree.”  
  - [ ] `/timeline?tree=zeo` → `/delivery?view=timeline&tree=zeo` (order of query params flexible).  
  - [ ] No drag/write; `/health` OK.

## Dev Notes

### Scope boundary (critical)

| In scope | Out of scope |
| --- | --- |
| One `DeliveryItem[]` + board / table / timeline | Search overlay (4.1) |
| `sprint-status.yaml` parse + precedence | Reading `sprint-status-dashboard.yaml` for status |
| `/timeline` → `/delivery?view=timeline` | Tests catalog (4.2) |
| Chips + URL `view` | Drag-to-change status / write-back |
| UX-DR11 back link from Epic/Story Reader | Inventing Epic rows from sprint keys without files |
| Fix `in-progress` → union `in-progress` | New board columns; Sample World |

### Sprint-status filename resolution (not a HALT)

Architecture repeatedly names **`sprint-status.yaml`** as the Delivery status file ([Source: architecture-dashboard.md Data Architecture + Important Decisions]). Dashboard’s BMAD tracking file `sprint-status-dashboard.yaml` is a **separate process artifact** for this epic stream; it is not an architecture-authorized Delivery input. Classify already surfaces it as Doc. **Parse only exact basename `sprint-status.yaml`.** No product/architecture fork; no HALT.

### Exhaustive current-state analysis (read before coding)

**Baseline tip `4209090` (story 3.2 done).**

#### Delivery stub today

```9:17:apps/dashboard/src/routes/delivery/+page.svelte
<div class="space-y-2">
  <h1 class="text-display text-foreground">Epics &amp; Stories</h1>
  <p class="text-muted-foreground">No Epics &amp; Stories in this Tree.</p>
  …
</div>
```

- No `+page.server.ts`, no `timeline` route, no `delivery.ts`, no board/table/timeline components.  
- Nav label “Epics & Stories” → `/delivery` already (`nav.ts`).  
- Empty copy must become literal **“No Epics in this Tree.”** (UX-DR14 / AC).

#### Status module (3.2) — must extend

```22:39:apps/dashboard/src/lib/catalog/status.ts
// today: in-progress → unknown (Catalog-safe for 3.2)
// 3.3: in-progress → in-progress so board column is real
```

Snapshot already attaches `status` / `statusLabel` on epic/story Kind when `Status:` exists (`read-tree.ts`). Delivery **overlays** sprint-status without re-reading markdown in each view.

#### Live tree shapes

| Tree | Epics | Stories | `sprint-status.yaml` |
| --- | --- | --- | --- |
| zeo | packs + `N-epic-*.md` | many `N-M-*.md` | yes — keys match story stems |
| pocket-dimension | `epics.md`, `epics-dashboard.md` | rhymes + dashboard story files | yes — **rhymes** keys; plus Doc `sprint-status-dashboard.yaml` (ignore for Delivery) |
| chhan-chhan | none | none | none → empty Delivery |

#### Architecture tree (implement these paths)

- `$lib/catalog/delivery.ts` + `delivery.test.ts`  
- `$lib/components/delivery-{board,table,timeline}.svelte`  
- `routes/delivery/+page.server.ts` + update `+page.svelte`  
- `routes/timeline/+page.server.ts` redirect  
- kebab-case only; `DeliveryItem` PascalCase type  
- Parsers pure in `$lib/catalog`; `fs` only in `$lib/server`

#### UX / PRD anchors

- FR-14 / FR-15; UJ-6; UX-DR9 / UX-DR11 / UX-DR14  
- Default view **board**; Timeline = process rail not calendar  
- Banned: drag-to-change-status  
- Mockup: `ux-designs/ux-dashboard-2026-08-23/mockups/delivery.html`

### Project Structure Notes

```
apps/dashboard/src/
  lib/
    types.ts                         # UPDATE — DeliveryItem, DeliveryView
    experience-copy.ts               # UPDATE — deliveryEmpty
    catalog/
      status.ts                      # UPDATE — in-progress mapping
      status.test.ts                 # UPDATE
      delivery.ts                    # NEW — projection + yaml parse + view parse
      delivery.test.ts               # NEW
    server/
      load-delivery.ts               # NEW — read sprint-status.yaml + projectDelivery
      read-tree.ts                   # PRESERVE (Status: still attached)
      load-by-slug.ts                # PRESERVE
    components/
      delivery-board.svelte          # NEW
      delivery-table.svelte          # NEW
      delivery-timeline.svelte       # NEW
      ui/table/**                    # REUSE
      ui/tabs/**                     # OPTIONAL for chips
  routes/
    delivery/+page.server.ts         # NEW
    delivery/+page.svelte            # UPDATE — replace stub
    timeline/+page.server.ts         # NEW — redirect
    epics/[id]/+page.svelte         # UPDATE — back → Delivery
    stories/[id]/+page.svelte       # UPDATE — back → Delivery
```

Conflict note: rhymes story files share `N-M-` prefixes with dashboard stories in the same pocket-dimension tree — Delivery lists **both** as Story Kind (honesty). Status comes from rhymes `sprint-status.yaml` when keys match; dashboard stories use `Status:` / unknown.

Conflict note: Do **not** mark `epic-3` done; only flip `3-3-…` backlog → ready-for-dev.

### Previous story intelligence (3.2)

- Reader routes `/epics/[id]`, `/stories/[id]` with `load-by-slug` + `MarkdownReader` — open targets for Delivery cards/nodes.  
- `status.ts` + ArtifactRef optional fields — reuse; fix `in-progress` mapping.  
- resolve-link already prefers Kind routes — preserve.  
- Explicitly left Delivery projection / board / `/timeline` for 3.3.  
- UX-DR11 back via Delivery was deferred — complete here.  
- 99 tests green at 3.2 done; keep Features/Docs regressions green.

### Git intelligence

Recent on `cursor/dashboard-epic-1-66a2`:

- `4209090` — story 3.2 Epic/Story Reader + optional Status  
- `e517759` — story 3.1 Features  
- `0f95ac8` — realpath-contain catalog walk  
- `2df08a9` — honest empty / unreadable  

Implement atop 3.2; first surface that consumes a derived Delivery dataset.

### Latest tech information

- Stack unchanged: Svelte 5 runes, SvelteKit 2, Bun, Tailwind 4, shadcn tabs/table already vendored.  
- YAML: `Bun.YAML.parse` — no `js-yaml` dependency.  
- URL query keys lowercase `tree` / `view` only.  
- Port **3011**; no auth/DB.

### Testing requirements

Automated:

```bash
cd apps/dashboard
bun test src
bun run check
```

Cover at minimum: `delivery.test.ts` (precedence, extras→unknown, missing yaml, orphan keys, view default); updated `status.test.ts` for `in-progress`; no Features/Docs regressions.

Manual (required evidence for done):

1. zeo board → open Story; Timeline order; sprint statuses  
2. pocket-dimension lists files; dashboard yaml not used as status source  
3. chhan-chhan empty copy  
4. `/timeline` redirect preserves tree  
5. Epic/Story Reader back link → Delivery  

### Project context reference

- App: `apps/dashboard`, port **3011**, standalone  
- BMAD trees under `_bmad-output/{pocket-dimension,zeo,chhan-chhan}/`  
- Dashboard sprint tracking file: `sprint-status-dashboard.yaml` (process only)  
- Delivery status file per architecture: `sprint-status.yaml`

### References

- [Source: epics-dashboard.md — Epic 3 / Story 3.3]  
- [Source: prd-dashboard-2026-08-23/prd.md — FR-14, FR-15, UJ-6]  
- [Source: architecture-dashboard.md — Delivery projection, status precedence, routes, delivery-*.svelte, Important Gaps statusLabel]  
- [Source: ux-dashboard-2026-08-23/EXPERIENCE.md — UX-DR9, Flow 6, empty copy]  
- [Source: ux-dashboard-2026-08-23/DESIGN.md — tokens; no decorative status parade]  
- [Source: ux-dashboard-2026-08-23/mockups/delivery.html]  
- [Source: implementation-artifacts/3-2-open-epics-and-stories-with-optional-status.md]  
- [Source: apps/dashboard delivery stub, status.ts, read-tree.ts, nav.ts, types.ts]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Epic-end P1: `groupDeliveryForTimeline` attaches pack epics (`epics.md` / `epics-*.md`) as openable milestones on numbered story groups when no per-number epic files exist; pack epics no longer orphan under Other on pocket-dimension-style trees.

### File List

- apps/dashboard/src/lib/catalog/delivery.ts (updated — pack epic timeline nesting)
- apps/dashboard/src/lib/catalog/delivery.test.ts (updated — pack-only tree timeline tests)

## Change Log

- 2026-08-23: Story 3.3 context created — Delivery projection, board/table/timeline, sprint-status.yaml-only status source.
- 2026-08-23: Epic-end P1 — Timeline nests numbered stories under pack epic milestones for pack-only trees.

## Story Completion Status

Status: **done**

Ultimate context engine analysis completed - comprehensive developer guide created.
