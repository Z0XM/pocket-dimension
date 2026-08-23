---
stepsCompleted: ['step-01-document-discovery', 'step-02-prd-analysis', 'step-03-epic-coverage-validation', 'step-04-ux-alignment', 'step-05-epic-quality-review', 'step-06-final-assessment']
assessmentTrack: dashboard
includedFiles:
  prd:
    - prds/prd-dashboard-2026-08-23/prd.md
    - prds/prd-dashboard-2026-08-23/addendum.md
    - prds/prd-dashboard-2026-08-23/.decision-log.md
  ux:
    - ux-designs/ux-dashboard-2026-08-23/DESIGN.md
    - ux-designs/ux-dashboard-2026-08-23/EXPERIENCE.md
  architecture:
    - architecture-dashboard.md
  epics: []
excludedAsDifferentProduct:
  - prds/prd-rhymes-revamp-2026-06-20/prd.md
  - ux-designs/ux-rhymes-revamp-2026-06-20/DESIGN.md
  - ux-designs/ux-rhymes-revamp-2026-06-20/EXPERIENCE.md
  - architecture.md
  - product-brief-rhymes-revamp.md
  - epics.md
---

# Implementation Readiness Assessment Report

**Date:** 2026-08-23
**Project:** pocket-dimension

## Document Inventory

Assessment track: **dashboard** (confirmed by Continue; rhymes artifacts excluded as a separate product).

### PRD
- `prds/prd-dashboard-2026-08-23/prd.md` (25.4 KB, 2026-08-23 16:58)
- `prds/prd-dashboard-2026-08-23/addendum.md` (3.6 KB, 2026-08-23 16:58)
- `prds/prd-dashboard-2026-08-23/.decision-log.md` (3.6 KB, 2026-08-23 16:58)

### Architecture
- `architecture-dashboard.md` (36.4 KB, 2026-08-23 19:23)

### Epics & Stories
- None included. `epics.md` is the only epics file in this folder and is not dashboard-named; excluded pending later coverage check.

### UX
- `ux-designs/ux-dashboard-2026-08-23/DESIGN.md` (5.3 KB, 2026-08-23 16:59)
- `ux-designs/ux-dashboard-2026-08-23/EXPERIENCE.md` (6.2 KB, 2026-08-23 17:00)
- `ux-designs/ux-dashboard-2026-08-23/mockups/` (`overview.html`, `search.html`, `delivery.html`)

## PRD Analysis

Source: `prds/prd-dashboard-2026-08-23/prd.md` (status: final), plus `addendum.md` and `.decision-log.md`. Reconcile notes and `review-rubric.md` add no additional FRs/NFRs.

### Functional Requirements

FR-1: Discover BMAD Trees — Ubuntu can see every Current BMAD Tree. Realizes UJ-1, UJ-3.
- The Catalog lists each Current BMAD Tree that exists at read time.
- A leftover or stale first-level folder under the BMAD Root does not appear as a BMAD Tree.
- Adding or removing a Current BMAD Tree on disk is reflected the next time the Catalog is loaded. v1 reloads on navigation or page load; live file watching is not required.

FR-2: Browse by Artifact Kind — Ubuntu can browse Artifacts in a BMAD Tree grouped by Artifact Kind. Realizes UJ-1, UJ-2.
- Epic, Story, documentation, and other classified Kinds each have a Catalog entry when at least one Artifact of that Kind exists.
- An Artifact appears in exactly one primary Kind grouping. If classification is ambiguous, the Artifact still appears once, under the best Kind or under unclassified.

FR-3: Open an Artifact from the Catalog — Ubuntu can open any listed Artifact into the Reader. Realizes UJ-1, UJ-2, UJ-3.
- Selecting an Artifact shows that Artifact in the Reader without leaving dashboard.
- The Catalog remains usable so Ubuntu can move to a sibling Artifact without starting over.

FR-4: Present Artifact content — Ubuntu can read the content of a selected Artifact in the Reader. Realizes UJ-1, UJ-2.
- A markdown Artifact renders as structured document content, not only as a raw source dump.
- A run folder (for example a PRD workspace) exposes its primary document and lists sibling files in that folder so Ubuntu can open them. `prd.md` is the primary document when present; otherwise the Reader lists the folder contents.

FR-5: Follow in-document links — Ubuntu can follow links from one Artifact to another Artifact or to a heading when the link target is inside the BMAD Root. Realizes UJ-1, UJ-2.
- A relative link to another BMAD file opens that Artifact in the Reader.
- A link the Showcase cannot resolve is still visible and is marked as unresolved rather than failing silently.

FR-6: Empty, missing, and parse-failure states — Ubuntu can tell when a Tree, Kind, or Artifact cannot be shown. Realizes UJ-1 edge.
- An empty BMAD Tree or Kind shows an empty state, not a blank page.
- A missing or unreadable Artifact shows an error in the Reader; the rest of the Catalog still works.

FR-7: Epic Showcase — Ubuntu can view Epics for a BMAD Tree and open Stories referenced by an Epic. Realizes UJ-1.
- Epic Artifacts are listed as Artifact Kind Epic.
- From an Epic view, referenced Stories that exist as Artifacts are openable. v1 uses links and filenames already in the Epic document; it does not require a separate story-index schema.

FR-8: Story Showcase — Ubuntu can view Stories and read each Story as a Showcase page. Realizes UJ-1.
- Story Artifacts are listed as Artifact Kind Story.
- Status and title are visible in the Catalog or Reader header when present in the file. Status is taken from existing Story conventions (for example a Status line). Stories without status still list and open.

FR-9: Feature and FR visibility — Ubuntu can see Features and Functional Requirements that are written in planning Artifacts (especially PRDs). Realizes UJ-2, UJ-3.
- Opening a PRD (or equivalent planning Artifact) makes Feature headings and FR identifiers readable in the Reader.
- The Features surface (FR-13) lists those same Features; it does not invent Features that are not in planning Artifacts.

FR-10: Dogfood dashboard Artifacts — Ubuntu can find dashboard’s own planning and implementation Artifacts in the Showcase. Realizes UJ-3.
- This PRD and subsequent dashboard UX, architecture, Epic, and Story Artifacts appear in the relevant BMAD Tree once they exist on disk.
- dashboard does not special-case itself beyond being Artifacts in the BMAD record.

FR-11: Quiet professional presentation — Ubuntu sees a minimal dark Showcase that does not compete with Artifact content.
- Background is black or a shade of black; accent is a purple or violet shade; body type is Fira Code (see addendum).
- Chrome (nav, Catalog, headers) stays visually quieter than the Reader content.
- The surface stays usable on a desktop or laptop browser viewport. v1 is desktop-first; a dedicated mobile layout is out of scope.

FR-12: Search Artifact content — Ubuntu can run a full-text Search and open a hit as an Artifact in the Reader. Realizes UJ-4.
- A query matches text inside Artifact content (for example an FR identifier or a sentence), not titles alone.
- Each hit names the Artifact, its Artifact Kind, and its BMAD Tree, and shows enough surrounding text to judge the match.
- Opening a hit shows that Artifact in the Reader.
- A query with no matches shows an empty Search state.
- Search does not include leftover or stale trees.
- Matching is case-insensitive substring or simple token match. No query language.
- Search runs across all Current BMAD Trees and can narrow to the BMAD Tree Ubuntu is already viewing.
- Binary or non-text files are skipped.
- Out of scope for this FR: query operators, saved searches, and ranking tuning beyond “this text appears in this Artifact.”

FR-13: List Features from planning Artifacts — Ubuntu can see Features and FR identifiers for the selected Current BMAD Tree and open the Artifact that defines each one. Realizes UJ-5.
- Features that appear in PRDs (or equivalent planning Artifacts) appear on the Features surface.
- Selecting a Feature opens that Artifact in the Reader.
- A Tree with no Feature/FR sections shows an empty Features state.

FR-14: Delivery board of Epics and Stories — Ubuntu can view Epics and Stories for the selected Tree as a board or table and open either into the Reader. Realizes UJ-1, UJ-6.
- Delivery lists Epics and their Stories when those Artifacts exist.
- Status is shown when present in Story conventions or `sprint-status.yaml`.
- Selecting an Epic or Story opens that Artifact.

FR-15: Process Timeline — Ubuntu can view a process-ordered Timeline of Epics and Stories (not a calendar). Realizes UJ-6.
- Timeline shows Epics in document or process order with Stories under them.
- A Story or Epic on the Timeline is openable.
- Missing sprint-status does not hide Epics or Stories that exist as files.

FR-16: Catalog existing tests — Ubuntu can see tests found for the repo or selected Tree and open a listed test when a path exists. Realizes UJ-7.
- Tests that exist on disk appear on the Tests surface.
- An empty catalog shows an empty Tests state.
- The Tests surface does not seed or display Sample World or sample-data fixtures.
- v1 does not require in-dashboard test execution.

FR-17: Overview of the selected Tree — Ubuntu can see a summary of the selected Current BMAD Tree and jump to Features, Delivery, Tests, or Docs. Realizes UJ-3, UJ-6.
- Overview names the selected Tree and does not include leftover Trees.
- Overview links to Features, Delivery, Tests, and Docs.

Total FRs: 17

### Non-Functional Requirements

NFR-1 (Clarity): Reader content remains the highest-contrast, most readable region of the page.

NFR-2 (Honesty): Parse and link failures are visible; the Showcase does not invent Artifacts that are not on disk and does not present leftover or stale BMAD trees.

NFR-3 (Performance): Opening a typical Artifact (single markdown file) feels immediate on a local machine. A multi-second wait on a normal Story is a defect. No hard numeric performance budget.

NFR-4 (Accessibility): Keyboard can move through Catalog and into the Reader. Headings in rendered markdown keep their structure. WCAG AA is a target, not a formal audit gate for v1.

NFR-5 (Security): v1 is local/internal. The Reader does not execute untrusted scripts from markdown. BMAD files are trusted repo content.

NFR-6 (Usability / presentation): Professional, quiet, typographic surface; desktop-first; black or near-black background; purple/violet accent; Fira Code body type (FR-11 + addendum tokens).

NFR-7 (Data / architecture constraint): Read from the filesystem (or an equivalent repo-local source) is enough; no database. No auth-service, accounts, sessions, or sharing links.

Total NFRs: 7

### Additional Requirements

**User journeys (must be completable without the editor — SM-1):** UJ-1 Epic→Story; UJ-2 brownfield documentation; UJ-3 dashboard dogfood; UJ-4 Search; UJ-5 Features catalog; UJ-6 Delivery and Timeline; UJ-7 Tests catalog.

**Success metrics:** SM-1 (UJ-1–UJ-7 against Current BMAD Trees, validates FR-1–FR-10, FR-12–FR-17); SM-2 (finished internal product look, validates FR-11); SM-3 (new BMAD file appears on next load and via Search). Counter-metrics: SM-C1 no chrome bloat / no deferred SIS pages; SM-C2 no clever visualization at the expense of readable documents.

**Explicit non-goals (v1 must not implement):** editor; host for other people’s BMAD; Pocket replacement / hub tile; museum of stale docs; Sample World; API docs nav; SIS chrome clone; auth-backed product; project-manager writes of Story status; AI chat; replacement for BMAD as source of truth; dedicated nav for Blockers, Questions, or Deferred.

**MVP out of scope:** public publish; in-browser editing or status writes; auth/multi-user/comments; live reload on every file save; mobile-first layout; Pocket hub listing; leftover/stale trees; Sample World; §6.3 backlog (Blockers, Questions, Deferred, test runner, API docs, Pocket hub tile).

**Platform:** local web app in this monorepo, desktop/laptop browser. Not v1: native apps, PWA install, public hosting as a product.

**Integration:** BMAD files under `_bmad-output/` are source of truth. Current BMAD Trees are names in `_bmad-output/README.md` (today: pocket-dimension, zeo, chhan-chhan). Process dependency: UX, architecture, epics, and stories for dashboard are written in BMAD before or as they are implemented, in the default pocket-dimension BMAD Tree.

**Addendum (not FR language; architecture/UX own):** app likely `apps/dashboard`, SvelteKit + Tailwind + shadcn/bits-ui; standalone; port 3011; configurable BMAD Root; in-memory search acceptable; deploy from repo root if deployed.

**Accepted inferences (§9):** unclassified files still appear; catalog refresh on navigation/page load; ambiguous classification shows Artifact once; `prd.md` is primary in a PRD folder; Epic→Story uses existing links/filenames; Story status optional; Features extracted only from planning Artifacts; Timeline is process order; Tests v1 is catalog-only; Overview is a thin landing; Search is case-insensitive substring or simple token match and can narrow to the Tree in view; non-text files skipped by Search.

### PRD Completeness Assessment

The PRD is status **final**, FR IDs are contiguous (FR-1–FR-17), journeys UJ-1–UJ-7 and success metrics are named, and open questions are empty of blockers. Scope honesty is strong: non-goals and §6.3 backlog are explicit. Downstream note from `review-rubric.md`: FR-4 “structured document content” is qualitative (UX/architecture must name headings, lists, tables, links). Visual tokens live in the addendum rather than FR language, but FR-11 binds black/violet/Fira Code. No blocking PRD gaps for extraction; coverage risk is whether epics exist for this track (none included in inventory).

## Epic Coverage Validation

Checked `planning-artifacts/epics.md` (only epics file in this folder). It is the **rhymes** epic breakdown (`inputDocuments` point at `prd-rhymes-revamp-2026-06-20`, `architecture.md`, and `ux-rhymes-revamp-2026-06-20`). It has no dashboard FR coverage map and no dashboard stories.

### Coverage Matrix

| FR Number | PRD Requirement | Epic Coverage | Status |
| --------- | --------------- | ------------- | ------ |
| FR-1 | Discover BMAD Trees | **NOT FOUND** — no dashboard epics document | ❌ MISSING |
| FR-2 | Browse by Artifact Kind | **NOT FOUND** | ❌ MISSING |
| FR-3 | Open an Artifact from the Catalog | **NOT FOUND** | ❌ MISSING |
| FR-4 | Present Artifact content | **NOT FOUND** | ❌ MISSING |
| FR-5 | Follow in-document links | **NOT FOUND** | ❌ MISSING |
| FR-6 | Empty, missing, and parse-failure states | **NOT FOUND** | ❌ MISSING |
| FR-7 | Epic Showcase | **NOT FOUND** | ❌ MISSING |
| FR-8 | Story Showcase | **NOT FOUND** | ❌ MISSING |
| FR-9 | Feature and FR visibility | **NOT FOUND** | ❌ MISSING |
| FR-10 | Dogfood dashboard Artifacts | **NOT FOUND** | ❌ MISSING |
| FR-11 | Quiet professional presentation | **NOT FOUND** | ❌ MISSING |
| FR-12 | Search Artifact content | **NOT FOUND** | ❌ MISSING |
| FR-13 | List Features from planning Artifacts | **NOT FOUND** | ❌ MISSING |
| FR-14 | Delivery board of Epics and Stories | **NOT FOUND** | ❌ MISSING |
| FR-15 | Process Timeline | **NOT FOUND** | ❌ MISSING |
| FR-16 | Catalog existing tests | **NOT FOUND** | ❌ MISSING |
| FR-17 | Overview of the selected Tree | **NOT FOUND** | ❌ MISSING |

Rhymes FR-1–FR-26 in `epics.md` are a different product and numbering space. They are not dashboard FRs and are not treated as “FRs in epics but not in this PRD.”

### Missing Requirements

### Critical Missing FRs

All 17 dashboard FRs are uncovered because there is no dashboard epics/stories document.

FR-1 through FR-17: full text is in PRD Analysis above.
- Impact: Phase 4 has no implementable epic/story path. The PRD itself requires UX, architecture, epics, and stories to be written in BMAD before or as they are implemented.
- Recommendation: Create a dashboard epics document (do not overwrite rhymes `epics.md`). Suggested epic split after UX/architecture alignment: Catalog & Overview (FR-1, FR-2, FR-3, FR-6, FR-17); Reader (FR-4, FR-5, FR-6, FR-9); Epic/Story/Feature surfaces (FR-7, FR-8, FR-9, FR-13); Delivery & Timeline (FR-14, FR-15); Search (FR-12); Tests catalog (FR-16); Presentation & dogfood (FR-10, FR-11).

### High Priority Missing FRs

None beyond the critical set — coverage is uniformly absent, not partially thin.

### Coverage Statistics

- Total PRD FRs: 17
- FRs covered in epics: 0
- Coverage percentage: 0%

## UX Alignment Assessment

### UX Document Status

**Found.** Both dashboard UX files are status `final`:
- `ux-designs/ux-dashboard-2026-08-23/DESIGN.md`
- `ux-designs/ux-dashboard-2026-08-23/EXPERIENCE.md`
- Supporting mocks: `mockups/overview.html`, `mockups/delivery.html`, `mockups/search.html` (EXPERIENCE: spines win on conflict)

Rhymes UX (`ux-rhymes-revamp-2026-06-20/`) is a different product and is not in this assessment.

### UX ↔ PRD Alignment

Aligned. EXPERIENCE maps every PRD journey (UJ-1–UJ-7) to a named flow and maps FR-1–FR-6, FR-12–FR-17 to surfaces. FR-7/FR-8 sit on Delivery + Epic/Story Reader. FR-9/FR-13 sit on Features. FR-10 is Flow 3 (dogfood). FR-11 is DESIGN.md (near-black `#0A0A0A`, violet `#8B5CF6`, Fira Code, shadcn brand-layer only).

Non-goals match: no Sample World, no API nav, no Blockers/Questions/Deferred in v1, no status write-back, no editor, desktop-first. Search is ⌘K / Ctrl+K and `/` with empty-hit copy.

UX decisions not spelled as PRD FRs (acceptable downstream ownership): Delivery default view = board; `/timeline` alias; Tests repo-wide with optional Tree filter; Search result groups; Feature-row text filter; cold-load “Reading BMAD…”; `< lg` sidebar sheet (usable, not a phone product); locked hex tokens instantiating the addendum families.

### UX ↔ Architecture Alignment

Aligned. `architecture-dashboard.md` lists both UX files as inputs and maps components to the EXPERIENCE IA:

| UX surface / component | Architecture support |
| --- | --- |
| Overview / Features / Delivery / Timeline / Tests / Docs | Routes `/`, `/features`, `/delivery?view=`, `/timeline` redirect, `/tests`, `/docs` |
| Epic / Story detail | `/epics/[id]`, `/stories/[id]` (require `?tree=`) |
| Tree switcher + section nav | URL owns `tree` + section; sidebar sheet `< lg` |
| Search palette | `search-overlay.svelte`, `keyboard.ts`, `searchCorpus` all trees + optional narrow |
| Reader markdown / unresolved links | `markdown.ts` + `resolve-link.ts`; DESIGN destructive for unresolved |
| Empty / error copy | Architecture error table uses EXPERIENCE strings verbatim |
| DESIGN tokens | `src/app.css`; Fira Code; no second typeface |

Architecture states: “No remaining contradiction with UX (Overview landing, board default, no dead nav).” Performance (request-time walk; multi-second Story open is a defect) and security (server sanitize, no `{@html}` of raw markdown) support UX Reader and honesty states.

### Alignment Issues

1. **Kind vs Feature naming (low).** EXPERIENCE voice table treats Feature as a Kind name. Architecture `ArtifactKind` has no `'feature'`; Features are extracted and omitted from Kind classification; unclassified files appear in Docs only. Agents could invent a Feature Kind. Contract should stay: Feature is a surface/extraction, not a file Kind.
2. **No dashboard epics (critical, already in coverage).** Architecture is FR-mapped and self-rated READY FOR IMPLEMENTATION, but PRD process dependency and this workflow still require an epics/stories document. UX cannot be implemented through stories that do not exist.

### Warnings

- UX is complete for a user-facing web Showcase; do not treat missing UX as a gap.
- Architecture supports the UX component list; the blocking gap is still missing dashboard epics, not UX↔architecture mismatch.
- Status-label mapping and test-path→tree prefixes are architecture closures, not UX conflicts; stories must lock them so Delivery columns and Tests filter match EXPERIENCE.

## Epic Quality Review

No dashboard epics or stories exist to validate. `epics.md` is the rhymes breakdown and is out of scope for this track. Quality checks below are applied to the **absence** of a dashboard epic document, plus constraints that any new epics must meet.

### Epic Structure Validation

Cannot score user-value titles, independence, or value-alone for dashboard epics — the document is missing.

Architecture already warns: “17 FRs, no dashboard epics yet. Design against FR-level intent, not an epic map.” That is correct for architecture and **incorrect** as a substitute for epics.

### Story Quality Assessment

No dashboard stories. No Given/When/Then ACs, sizing, or independence to review.

### Dependency Analysis

No within-epic or cross-epic dependencies to map.

**Database/entity timing:** N/A. Architecture forbids a product DB. Future stories must not create tables “for later.”

### Special Implementation Checks

**Starter template (architecture: YES).** When epics are written, **Epic 1 Story 1 must be** the sibling scaffold: copy `apps/pocket` → `apps/dashboard`, rename `@pocket-dimension/dashboard`, strip hub catalog, copy watchlist shadcn/`components.json`, add root `dev:app:dashboard` / `build:app:dashboard`, default `PORT=3011`. Fallback `sv create` only if copy is blocked.

**Greenfield vs brownfield:** Greenfield **app** inside a brownfield monorepo. Required early: project setup story (above). CI/CD / Dockerfile is architecture-deferred and must not be required to call v1 done. Integration points: `_bmad-output/` allow-list, `apps/**` test globs, Turbo filters — stories must name these, not invent a second repo.

### Best Practices Compliance Checklist (dashboard)

- [ ] Epic delivers user value — **cannot assess; no epics**
- [ ] Epic can function independently — **cannot assess**
- [ ] Stories appropriately sized — **cannot assess**
- [ ] No forward dependencies — **cannot assess**
- [ ] Database tables created when needed — N/A (no DB); do not invent schema
- [ ] Clear acceptance criteria — **cannot assess**
- [ ] Traceability to FRs maintained — **fail** (0% coverage)

### Quality Findings

#### Critical Violations

1. **Missing epic/stories artifact for dashboard.** Phase 4 has no user-value slices, no independence order, and no FR traceability path.
   - Remediation: Create `epics-dashboard.md` (or `prds/...` sibling) **without overwriting** rhymes `epics.md`. Cover FR-1–FR-17. Epic 1 Story 1 = sibling starter. Subsequent epics must stand on prior outputs only (Epic N cannot need Epic N+1).

2. **Architecture implementation sequence is not an epic substitute.** Sequence items 1–7 (scaffold → allow-list → markdown → classifier → delivery → extractors → chrome) are technical milestones. Promoting them unchanged would create technical epics (forbidden).
   - Remediation: Wrap the same work in user outcomes, e.g. “Ubuntu can open dashboard and switch Current BMAD Trees,” “Ubuntu can read a Story as a Showcase page,” “Ubuntu can search an FR id.”

#### Major Issues

1. **No story can lock architecture closures** (status precedence, searchCorpus vs snapshot, unclassified-in-Docs, test-path→tree prefixes, `resolve-link.ts`). Those will fork at implementation if left only in architecture.
   - Remediation: Put each closure in the first story that needs it, with testable ACs (including empty/error copy from EXPERIENCE.md).

#### Minor Concerns

1. Two products share `planning-artifacts/` with a generic `epics.md`. Easy to implement the wrong backlog.
   - Remediation: Name the new file for dashboard; leave rhymes `epics.md` untouched.

### Recommendations (when writing epics)

Suggested user-value epic order (not a substitute for the create-epics workflow):

1. **Open the Showcase** — scaffold + Tree switcher + Overview (FR-1, FR-17, FR-11 chrome baseline). Story 1.1 = starter template.
2. **Read documents** — Docs catalog + Reader + links + empty/error (FR-2–FR-6, FR-10).
3. **See Features** — extract and open defining Artifacts (FR-9, FR-13).
4. **Walk Delivery** — board/table/timeline of existing Epics/Stories (FR-7, FR-8, FR-14, FR-15).
5. **Find and verify** — Search (FR-12) and Tests catalog (FR-16).

Do not require Epic 5 to ship Epic 2. Do not write status back to disk. Do not add §6.3 nav.

## Summary and Recommendations

### Overall Readiness Status

**NOT READY**

PRD, UX, and Architecture for dashboard are final and aligned. Implementation cannot start: there is no dashboard epics/stories document, so FR coverage is 0%. Architecture’s “READY FOR IMPLEMENTATION” rating does not replace epics.

Assessor: BMad implementation-readiness (Ubuntu / pocket-dimension). Date: 2026-08-23. Track: dashboard.

### Critical Issues Requiring Immediate Action

1. **No dashboard epics or stories.** `epics.md` is rhymes. All 17 FRs (FR-1–FR-17) have no implementation path.
2. **Do not implement from the architecture sequence alone.** Items such as “sibling scaffold → allow-list → markdown pipeline” are technical milestones. Using them as epics violates create-epics standards.
3. **Do not overwrite rhymes `epics.md`.** Write a dashboard-named epics file.

### Recommended Next Steps

1. Run **create epics and stories** for dashboard, using `prd-dashboard-2026-08-23`, `ux-dashboard-2026-08-23`, and `architecture-dashboard.md`. Epic 1 Story 1 must be the pocket→dashboard sibling starter (port 3011).
2. Map every FR-1–FR-17 into that file. Put architecture closures (status precedence, searchCorpus, unclassified-in-Docs, `resolve-link.ts`, test-path→tree) in the first story that needs them.
3. Re-run this readiness check. Do not start Phase 4 until coverage is complete and stories have testable ACs (including EXPERIENCE.md empty/error copy).

### Final Note

This assessment identified **6 issues across 4 categories** (FR coverage, epic quality, Kind vs Feature naming, shared-folder collision). Address the critical issues before proceeding to implementation. These findings can be used to improve the artifacts or you may choose to proceed as-is — proceeding as-is means writing code without stories, which the PRD process dependency forbids.
