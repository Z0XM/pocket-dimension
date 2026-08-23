---
title: dashboard
status: final
created: 2026-08-23
updated: 2026-08-23
sources:
  - conversation: dashboard BMAD showcase plan 2026-08-23
  - conversation: SIS dev-dashboard inspiration 2026-08-23 (dev branch)
  - _bmad-output/README.md
  - _bmad-output/pocket-dimension/project-context.md
  - /home/z0xm/sales-incentives-service/packages/dev-dashboard (branch: dev)
---

# PRD: dashboard

## 0. Document Purpose

This PRD defines the **v1 base** of **dashboard** for Ubuntu (builder and only operator), and for downstream UX, architecture, and epic work. Vocabulary is Glossary-anchored. Features group Functional Requirements with globally stable IDs. Inferences Ubuntu accepted at Finalize are listed in §9.

Visual tokens Ubuntu named (black / near-black, purple-violet accent, shadcn, Fira Code) live in `addendum.md`. This PRD states the product requirement (professional, minimal Showcase) and does not specify implementation.

A later public product — other people presenting *their* BMAD work — is out of scope. That work uses the Coaching path and a new or updated PRD.

## 1. Vision

**dashboard** is a local web Showcase of the BMAD files that already live in this repo. It does not replace BMAD as the system of record. It reads those files and presents them so a developer can see the work as a product — epics, stories, documentation, features — instead of walking a folder tree in the editor.

The v1 bar is a **professional internal tool**, not a throwaway viewer. Layout is simple and minimal. The content is the point. The Showcase should feel finished enough that Ubuntu would leave it running while working, and finished enough that a future public version is a product expansion, not a rewrite of the idea.

Everything built for **dashboard** is itself planned and implemented through BMAD, and appears in the Showcase like any other Artifact. The product dogfoods its own record.

## 2. Target User

### 2.1 Jobs To Be Done

- See the current BMAD record as a visual Showcase instead of raw files.
- Move from an Epic to its Stories, and from a Feature or FR mention to the document that holds it, without hunting paths.
- Read brownfield documentation (overview, architecture, APIs, guides) in the same place as planning and implementation Artifacts.
- Confirm what exists for a BMAD Tree — including **dashboard**’s own Artifacts — at a glance.
- Find a phrase, Feature, or identifier in the BMAD record without knowing which Artifact holds it.
- Browse Features as a product catalog, not only inside a PRD.
- See Epics and Stories as a Delivery board and as a process Timeline.
- See which Tests exist for the work (catalog; not a Sample World lab).
- Keep a professional, quiet surface that does not compete with the documents.

### 2.2 Non-Users (v1)

- People outside this repo who want to point **dashboard** at their own BMAD folders.
- Editors who want to create or change BMAD files in the browser.
- Stakeholders who need accounts, sharing, or a hosted multi-tenant product.

### 2.3 Key User Journeys

Hobby / single-operator scope — light journeys.

- **UJ-1. Ubuntu opens an Epic and lands in a Story.** Ubuntu is mid-implementation and wants the Story in context, not as a path in the tree. Opens **dashboard**, picks the BMAD Tree, opens Epics, selects an Epic, follows a Story into the Reader. Climax: the Story body is readable as a Showcase page, with a way back to the Epic. Edge: a Story file is missing or unreadable — the Catalog still lists what parsed, and the Reader explains the miss.

- **UJ-2. Ubuntu reads brownfield documentation for an app.** Ubuntu needs the architecture or API contract for a part of the monorepo. Opens **dashboard**, finds Documentation in that BMAD Tree, opens the document in the Reader. Climax: headings, lists, and tables from the markdown are presented, not dumped as a pre block.

- **UJ-3. Ubuntu checks that dashboard itself is in BMAD.** After a planning or implementation pass, Ubuntu opens the pocket-dimension BMAD Tree and finds this PRD, later UX/architecture, and Stories. Climax: **dashboard** is visible as first-class work in the Showcase.

- **UJ-4. Ubuntu searches the record.** Ubuntu remembers a phrase or FR identifier, not the file. Types it into Search (⌘K or `/`). Climax: hits list the Artifact and enough surrounding text to judge; opening a hit lands in the Reader at that Artifact. Edge: no hits — an empty Search state, not a blank Catalog.

- **UJ-5. Ubuntu browses Features.** Ubuntu wants the product shape of a BMAD Tree, not a file path. Opens Features, scans names and FR identifiers, opens one into the Reader (the PRD or planning Artifact that defines it). Climax: the Feature is readable in context.

- **UJ-6. Ubuntu walks Delivery and Timeline.** Ubuntu wants where work stands. Opens Epics & Stories, switches Timeline, sees process order and status. Climax: opens the current Story from the rail. Edge: a Tree with no sprint-status still lists Epics and Stories from the files that exist.

- **UJ-7. Ubuntu checks Tests.** Ubuntu wants to know what tests exist for the repo or Tree. Opens Tests, sees a catalog of test files or cases that were found. Climax: can open a listed test’s source or related Story when a link exists. Edge: no tests found — empty Tests state, not a fake Sample World suite.

## 3. Glossary

- **dashboard** — This product: a web Showcase that reads BMAD files and presents them. Not a Pocket hub tile unless later added.
- **BMAD** — The method and file record used in this repo. Source of truth for planning and implementation docs. **dashboard** reads BMAD; it does not become the source of truth.
- **BMAD Root** — This repo’s `_bmad-output/` directory. It contains BMAD Trees.
- **BMAD Tree** — A first-class project folder under the BMAD Root. Only **Current BMAD Trees** appear in the Showcase.
- **Current BMAD Tree** — A living project tree named in `_bmad-output/README.md` (today: `pocket-dimension`, `zeo`, `chhan-chhan`). Leftover, duplicate, or stale folders are not Current. They are removed from the BMAD Root, not shown. A new living tree is added to that README before the Catalog will show it.
- **Artifact** — One BMAD file or one BMAD run folder that the Showcase treats as a navigable item (a PRD folder, a Story file, an architecture markdown, an Epic list, a UX pack, and so on).
- **Artifact Kind** — The role of an Artifact in the BMAD record: at least Epic, Story, PRD, UX, architecture, brownfield documentation, and other planning or implementation files the parser can classify. Unknown or unclassified files still appear as Artifacts rather than being hidden.
- **Catalog** — The navigable index of Current BMAD Trees, Artifact Kinds, and Artifacts.
- **Reader** — The Showcase surface that presents one Artifact’s content.
- **Search** — Full-text query over Artifact content in Current BMAD Trees. Results open in the matching surface (Reader, Feature, Story, Test).
- **Showcase** — The visual presentation of Overview, Features, Delivery, Timeline, Tests, Docs (Catalog + Reader), and Search. Read-only in v1.
- **Feature** — A capability described inside a PRD or related planning Artifact. The Features surface lists Features extracted from those Artifacts. **dashboard** does not invent a separate Feature database.
- **Delivery** — The Epics & Stories surface: board and table of Epics and Stories with status from existing BMAD files.
- **Timeline** — A process-ordered rail of Epics and Stories (status sequence, not a calendar).
- **Tests surface** — A catalog of tests found in the repo that can be shown and opened. Not a Sample World or fixture lab.

## 4. Features

### 4.1 Catalog of BMAD Trees and Artifacts

**Description:** On open, Ubuntu sees which Current BMAD Trees exist and can enter one. Inside a Tree, the Catalog groups Artifacts by Artifact Kind so Epics, Stories, documentation, and planning packs are findable without knowing the on-disk path. Leftover or stale trees are not listed. Realizes UJ-1, UJ-2, UJ-3.

**Functional Requirements:**

#### FR-1: Discover BMAD Trees

Ubuntu can see every Current BMAD Tree. Realizes UJ-1, UJ-3.

**Consequences (testable):**
- The Catalog lists each Current BMAD Tree that exists at read time.
- A leftover or stale first-level folder under the BMAD Root does not appear as a BMAD Tree.
- Adding or removing a Current BMAD Tree on disk is reflected the next time the Catalog is loaded. v1 reloads on navigation or page load; live file watching is not required.

#### FR-2: Browse by Artifact Kind

Ubuntu can browse Artifacts in a BMAD Tree grouped by Artifact Kind. Realizes UJ-1, UJ-2.

**Consequences (testable):**
- Epic, Story, documentation, and other classified Kinds each have a Catalog entry when at least one Artifact of that Kind exists.
- An Artifact appears in exactly one primary Kind grouping. If classification is ambiguous, the Artifact still appears once, under the best Kind or under unclassified.

#### FR-3: Open an Artifact from the Catalog

Ubuntu can open any listed Artifact into the Reader. Realizes UJ-1, UJ-2, UJ-3.

**Consequences (testable):**
- Selecting an Artifact shows that Artifact in the Reader without leaving **dashboard**.
- The Catalog remains usable so Ubuntu can move to a sibling Artifact without starting over.

### 4.2 Reader Showcase

**Description:** The Reader is the Showcase page for one Artifact. Markdown (and folder-index cases such as a PRD run folder) is presented as a professional document: hierarchy, emphasis, lists, tables, and links are visible as such. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-4: Present Artifact content

Ubuntu can read the content of a selected Artifact in the Reader. Realizes UJ-1, UJ-2.

**Consequences (testable):**
- A markdown Artifact renders as structured document content, not only as a raw source dump.
- A run folder (for example a PRD workspace) exposes its primary document and lists sibling files in that folder so Ubuntu can open them. `prd.md` is the primary document when present; otherwise the Reader lists the folder contents.

#### FR-5: Follow in-document links

Ubuntu can follow links from one Artifact to another Artifact or to a heading when the link target is inside the BMAD Root. Realizes UJ-1, UJ-2.

**Consequences (testable):**
- A relative link to another BMAD file opens that Artifact in the Reader.
- A link the Showcase cannot resolve is still visible and is marked as unresolved rather than failing silently.

#### FR-6: Empty, missing, and parse-failure states

Ubuntu can tell when a Tree, Kind, or Artifact cannot be shown. Realizes UJ-1 edge.

**Consequences (testable):**
- An empty BMAD Tree or Kind shows an empty state, not a blank page.
- A missing or unreadable Artifact shows an error in the Reader; the rest of the Catalog still works.

### 4.3 Epic, Story, and Feature surfaces

**Description:** Epics, Stories, and Features are first-class in the Showcase because that is what Ubuntu asked to see. When an Artifact has structure the parser understands (titles, status, acceptance criteria, FR lists, story lists), the Showcase uses that structure. When it does not, the Reader still shows the document. Realizes UJ-1, UJ-3.

**Functional Requirements:**

#### FR-7: Epic Showcase

Ubuntu can view Epics for a BMAD Tree and open Stories referenced by an Epic. Realizes UJ-1.

**Consequences (testable):**
- Epic Artifacts are listed as Artifact Kind Epic.
- From an Epic view, referenced Stories that exist as Artifacts are openable. v1 uses links and filenames already in the Epic document; it does not require a separate story-index schema.

#### FR-8: Story Showcase

Ubuntu can view Stories and read each Story as a Showcase page. Realizes UJ-1.

**Consequences (testable):**
- Story Artifacts are listed as Artifact Kind Story.
- Status and title are visible in the Catalog or Reader header when present in the file. Status is taken from existing Story conventions (for example a Status line). Stories without status still list and open.

#### FR-9: Feature and FR visibility

Ubuntu can see Features and Functional Requirements that are written in planning Artifacts (especially PRDs). Realizes UJ-2, UJ-3.

**Consequences (testable):**
- Opening a PRD (or equivalent planning Artifact) makes Feature headings and FR identifiers readable in the Reader.
- The Features surface (FR-13) lists those same Features; it does not invent Features that are not in planning Artifacts.

### 4.4 dashboard is itself in BMAD

**Description:** Work on **dashboard** is recorded in BMAD and is visible in the Showcase. This is a product rule, not only a process preference. Realizes UJ-3.

**Functional Requirements:**

#### FR-10: Dogfood dashboard Artifacts

Ubuntu can find **dashboard**’s own planning and implementation Artifacts in the Showcase. Realizes UJ-3.

**Consequences (testable):**
- This PRD and subsequent **dashboard** UX, architecture, Epic, and Story Artifacts appear in the relevant BMAD Tree once they exist on disk.
- **dashboard** does not special-case itself beyond being Artifacts in the BMAD record.

### 4.5 Professional, minimal chrome

**Description:** The Showcase looks like a finished internal product: dark, quiet, typographic, one accent. It uses a consistent component language. Realizes all journeys.

**Functional Requirements:**

#### FR-11: Quiet professional presentation

Ubuntu sees a minimal dark Showcase that does not compete with Artifact content.

**Consequences (testable):**
- Background is black or a shade of black; accent is a purple or violet shade; body type is Fira Code (see addendum).
- Chrome (nav, Catalog, headers) stays visually quieter than the Reader content.
- The surface stays usable on a desktop or laptop browser viewport. v1 is desktop-first; a dedicated mobile layout is out of scope.

### 4.6 Full-text Search

**Description:** Ubuntu can query Artifact body text, not only titles, and jump from a hit into the matching surface. Open Search with ⌘K / Ctrl+K or `/`. Search covers Current BMAD Trees only. Realizes UJ-4.

**Functional Requirements:**

#### FR-12: Search Artifact content

Ubuntu can run a full-text Search and open a hit as an Artifact in the Reader. Realizes UJ-4.

**Consequences (testable):**
- A query matches text inside Artifact content (for example an FR identifier or a sentence), not titles alone.
- Each hit names the Artifact, its Artifact Kind, and its BMAD Tree, and shows enough surrounding text to judge the match.
- Opening a hit shows that Artifact in the Reader.
- A query with no matches shows an empty Search state.
- Search does not include leftover or stale trees.
- Matching is case-insensitive substring or simple token match. No query language.
- Search runs across all Current BMAD Trees and can narrow to the BMAD Tree Ubuntu is already viewing.
- Binary or non-text files are skipped.

**Out of Scope:**
- Query operators, saved searches, and ranking tuning beyond “this text appears in this Artifact.”

### 4.7 Features catalog

**Description:** Ubuntu can browse Features extracted from planning Artifacts in the selected Current BMAD Tree, in the same spirit as the Sales Incentives Dev Dashboard Features page — without Sample World and without a second invented registry. Realizes UJ-5.

**Functional Requirements:**

#### FR-13: List Features from planning Artifacts

Ubuntu can see Features and FR identifiers for the selected Current BMAD Tree and open the Artifact that defines each one. Realizes UJ-5.

**Consequences (testable):**
- Features that appear in PRDs (or equivalent planning Artifacts) appear on the Features surface.
- Selecting a Feature opens that Artifact in the Reader.
- A Tree with no Feature/FR sections shows an empty Features state.

### 4.8 Delivery and Timeline

**Description:** Epics and Stories have a Delivery board (and table) plus a process Timeline, following the SIS Dev Dashboard `/delivery` views. Status comes from existing Story or sprint-status files. Realizes UJ-1, UJ-6.

**Functional Requirements:**

#### FR-14: Delivery board of Epics and Stories

Ubuntu can view Epics and Stories for the selected Tree as a board or table and open either into the Reader. Realizes UJ-1, UJ-6.

**Consequences (testable):**
- Delivery lists Epics and their Stories when those Artifacts exist.
- Status is shown when present in Story conventions or `sprint-status.yaml`.
- Selecting an Epic or Story opens that Artifact.

#### FR-15: Process Timeline

Ubuntu can view a process-ordered Timeline of Epics and Stories (not a calendar). Realizes UJ-6.

**Consequences (testable):**
- Timeline shows Epics in document or process order with Stories under them.
- A Story or Epic on the Timeline is openable.
- Missing sprint-status does not hide Epics or Stories that exist as files.

### 4.9 Tests catalog

**Description:** A Tests surface catalogs tests that exist in this repo. Inspired by the SIS Tests page. v1 does not require that runner, an L1–L5 model, or Sample World fixtures. Realizes UJ-7.

**Functional Requirements:**

#### FR-16: Catalog existing tests

Ubuntu can see tests found for the repo or selected Tree and open a listed test when a path exists. Realizes UJ-7.

**Consequences (testable):**
- Tests that exist on disk appear on the Tests surface.
- An empty catalog shows an empty Tests state.
- The Tests surface does not seed or display Sample World or sample-data fixtures.
- v1 does not require in-dashboard test execution.

### 4.10 Overview

**Description:** App open lands on a thin Overview for the selected Tree: counts and links into Features, Delivery, Tests, and Docs. Realizes UJ-3, UJ-6.

**Functional Requirements:**

#### FR-17: Overview of the selected Tree

Ubuntu can see a summary of the selected Current BMAD Tree and jump to Features, Delivery, Tests, or Docs. Realizes UJ-3, UJ-6.

**Consequences (testable):**
- Overview names the selected Tree and does not include leftover Trees.
- Overview links to Features, Delivery, Tests, and Docs.

## 5. Non-Goals (Explicit)

- **Not an editor.** v1 does not create, edit, move, or delete BMAD files.
- **Not a host for other people’s BMAD.** No repo picker, upload, or multi-tenant “present your BMAD” product. That is a future Coaching-path PRD.
- **Not a Pocket replacement.** v1 does not need to live on the Pocket hub. A hub tile is a later add, not part of calling v1 done.
- **Not a museum of stale docs.** Leftover or duplicate BMAD trees are removed from the BMAD Root and are not presented.
- **Not Sample World.** No sample-data lab, fixture browser, or “bring-up” seed UI (the SIS Data / Sample World pages are out).
- **Not API docs.** No API nav item. Pocket Dimension does not have that catalog set up; defer until it exists.
- **Not a clone of SIS chrome.** Inspiration is surfaces and behavior, not War Room grain, brand type, or React stack.
- **Not auth-backed.** No accounts, sessions, or sharing links.
- **Not a project manager.** No writing Story status back to disk. Delivery board is a view, not an editor.
- **Not an AI chat over the docs.**
- **Not a replacement for BMAD.** The files remain the record; **dashboard** only presents them.
- **Not v1 nav for Blockers, Questions, or Deferred.** Ubuntu wants those SIS surfaces; they are deferred, not dropped. Until they ship, those Artifacts can still appear under Docs.

## 6. MVP Scope

### 6.1 In Scope

- Web Showcase that reads Current BMAD Trees under the BMAD Root.
- Overview, Features, Delivery (board/table), Timeline, Tests, and Docs (Catalog + Reader).
- In-BMAD-Root link following, plus honest empty/error states.
- Full-text Search (⌘K and `/`) across Current BMAD Trees.
- Features extracted from planning Artifacts; Epics/Stories first-class; process Timeline.
- Tests catalog of files that exist (no runner required).
- **dashboard**’s own BMAD Artifacts visible once written.
- Professional minimal dark chrome with the stated type and accent.

### 6.2 Out of Scope for MVP

- Public publish / “anyone’s BMAD” (deferred; Coaching path when Ubuntu wants that).
- In-browser editing or status writes.
- Auth, multi-user, comments.
- Live reload on every file save.
- Mobile-first layout.
- Pocket hub listing (deferred to a later pass; not required to call v1 done).
- Showing leftover or stale BMAD trees.
- Sample World / sample-data surfaces (not wanted).
- Items in §6.3 (wanted later, not v1).

### 6.3 Wanted later (not v1)

Ubuntu confirmed these SIS surfaces. They are backlog, not abandoned.

- **Blockers** — dedicated nav/page for blocked Stories and named blockers.
- **Questions** — dedicated nav/page for open questions in planning Artifacts.
- **Deferred** — dedicated nav/page for deferred-work items.
- **Test runner** — run tests from the Tests surface (v1 stays catalog-only).
- **API docs** — nav item when an API catalog exists.
- **Pocket hub tile** — list **dashboard** on pocket.

## 7. Success Metrics

Internal hobby tool — qualitative, still testable.

**Primary**
- **SM-1**: Ubuntu can complete UJ-1 through UJ-7 against Current BMAD Trees without opening the files in the editor. Validates FR-1–FR-10, FR-12–FR-17.
- **SM-2**: A first-time look at the Showcase reads as a finished internal product (dark, minimal, typed, accent used sparingly), not a debug page. Validates FR-11.

**Secondary**
- **SM-3**: After a BMAD file is added under a Current BMAD Tree, it appears on the matching surface on the next load and is findable via Search. Validates FR-1, FR-10, FR-12, FR-13, FR-14.

**Counter-metrics (do not optimize)**
- **SM-C1**: Number of chrome widgets. Do not add surfaces that do not help UJ-1–UJ-7. Do not copy SIS pages we deferred (Sample World, API).
- **SM-C2**: Clever visualization for its own sake (graphs, particles, dense dashboards) at the expense of readable documents.

## 8. Open Questions

None that block v1.

## 9. Accepted Inferences

Ubuntu accepted these on 2026-08-23 (“continue”). They are decisions, not open questions.

- BMAD Root is `_bmad-output/` in this repo.
- Current BMAD Trees are the names in `_bmad-output/README.md`; other first-level folders are excluded.
- Unclassified files still appear as Artifacts.
- Catalog refreshes on navigation or page load; no file watcher required.
- Ambiguous classification still shows the Artifact once.
- `prd.md` is primary inside a PRD run folder.
- Epic→Story uses existing document links and filenames.
- Story status is optional and read from existing Story conventions.
- Features surface is extracted from planning Artifacts; no second Feature database.
- Desktop-first.
- Timeline is process order, not calendar.
- Tests v1 is a catalog, not a runner.
- Overview is a thin landing.
- Blockers, Questions, Deferred, test runner, and API nav are wanted later (§6.3), not v1.
- Search matching is case-insensitive substring or simple token match.
- Search covers all Current BMAD Trees and can narrow to the Tree in view.
- Non-text files are skipped by Search.
- Read from the filesystem (or an equivalent repo-local source) is enough; no database.
- No hard numeric performance budget; a multi-second wait on a normal Story is a defect.
- WCAG AA is a target, not a formal audit gate for v1.
- BMAD files are trusted repo content; the Reader still does not execute scripts from markdown.

## 10. Platform

- **v1:** local web app in this monorepo, used in a desktop or laptop browser.
- **Not v1:** native apps, PWA install, public hosting as a product.

## 11. Integration and Dependencies

- **Source of truth:** BMAD files under the BMAD Root. **dashboard** never holds a second copy of the product record as the canonical store.
- **No auth-service, no database** for v1. Read from the filesystem (or an equivalent repo-local source).
- **Process dependency:** UX, architecture, epics, and stories for **dashboard** are written in BMAD before or as they are implemented, in the default pocket-dimension BMAD Tree unless Ubuntu redirects the tree.
- **Inspiration:** Sales Incentives `packages/dev-dashboard` on branch `dev` — surfaces only (Overview, Features, Epics & Stories, Timeline, Tests, Docs, Search). Not a visual or stack clone. Sample World / Data and API nav are excluded.

## 12. Cross-Cutting NFRs

- **Clarity:** Reader content remains the highest-contrast, most readable region of the page.
- **Honesty:** Parse and link failures are visible; the Showcase does not invent Artifacts that are not on disk and does not present leftover or stale BMAD trees.
- **Performance:** Opening a typical Artifact (single markdown file) feels immediate on a local machine. A multi-second wait on a normal Story is a defect.
- **Accessibility:** Keyboard can move through Catalog and into the Reader. Headings in rendered markdown keep their structure. WCAG AA is a target, not a formal audit gate for v1.
- **Security:** v1 is local/internal. The Reader does not execute untrusted scripts from markdown.

## 13. Aesthetic and Tone

- Dark, minimal, typographic. One accent family (purple / violet). No decorative clutter.
- Voice of product chrome: short, literal, developer-facing. No marketing copy.
- Anti-references: generic admin templates, rainbow dashboards, card grids that hide the document.
- Token-level color and type decisions: `addendum.md`.
