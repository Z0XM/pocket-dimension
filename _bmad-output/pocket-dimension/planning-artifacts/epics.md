---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - /workspace/_bmad-output/pocket-dimension/planning-artifacts/prds/prd-rhymes-revamp-2026-06-20/prd.md
  - /workspace/_bmad-output/pocket-dimension/planning-artifacts/architecture.md
  - /workspace/_bmad-output/pocket-dimension/planning-artifacts/ux-designs/ux-rhymes-revamp-2026-06-20/EXPERIENCE.md
---

# rhymes - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for rhymes, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR-1: Present a persistent reading surface where the selected content is visible without requiring a separate content-detail route for basic reading.

FR-2: Support browsing, filtering, searching, and reading within one continuous experience.

FR-3: Support four content types: poem, article, song, and diary.

FR-4: Support moving between content pieces quickly from the browse surface without losing reading context.

FR-5: Support content split into explicit pages and allow the reader to move page by page within a content piece.

FR-6: Allow the same content model to render in a continuous flow mode when appropriate.

FR-7: Show a bottom-docked quick composer for users with create access.

FR-8: Support single-action short-form quick submission behavior.

FR-8a: Save the quick composer content as a draft when the creator presses `Enter`.

FR-8b: Expose a separate publish action beside the save action.

FR-9: Provide an expanded editor for longer-form and more structured content creation.

FR-10: Support plain text, Markdown, and sanitized HTML authoring.

FR-11: Allow users with edit access to modify existing Markdown and HTML content directly.

FR-12: Allow users with edit access to apply text color, background color, font family, and font size to arbitrary content ranges.

FR-13: Allow users with edit access to style titles with text color, background color, font family, and font size.

FR-14: Allow users with edit access to upload and assign title art or cover art for a content piece.

FR-15: Allow users with edit access to insert, remove, and reorder explicit page breaks inside a content piece.

FR-16: Support draft and published content states.

FR-16a: Ensure drafts are never publicly visible.

FR-16b: Allow published content to be public by default and optionally hidden by an authorized creator/admin.

FR-17: Allow the creator of a content piece to rate that content from 0 to 10.

FR-18: Allow any logged-in user to rate content from 0 to 10.

FR-19: Store and expose creator rating, user rating summary, rating count, and average rating as separate values where relevant.

FR-20: Allow a user to update their prior rating.

FR-21: Support rhymes-specific user access separate from any global platform role.

FR-22: Allow rhymes admins to mark a user account as having rhymes admin or editor access through an administrative user-management surface.

FR-23: Support granting edit access to specific content pieces.

FR-24: Preserve enough document history to support safe editing and future revision browsing.

FR-25: Support importing the existing markdown corpus from `apps/rhymes/src/assets/rhymes`.

FR-26: Correctly render imported plain text and Markdown content without requiring full manual reconstruction.

### NonFunctional Requirements

NFR-1: Maintain high readability, strong keyboard usability, and sufficient contrast in the monochrome/off-black visual system.

NFR-2: Keep the reading experience responsive as the content library grows beyond the current corpus size.

NFR-3: Sanitize all user-authored HTML before public rendering.

NFR-4: Keep content exportable to durable, non-proprietary formats such as Markdown and HTML snapshots.

NFR-5: Keep the content and asset model extensible for future repeating page background image support.

NFR-6: Make content writes, permission changes, and publication actions attributable to authenticated users.

### Additional Requirements

- Reuse the monorepo shared auth session model and shared DB schema conventions including `created_by_id` and `updated_by_id`.
- Prefer database-backed content as the long-term source of truth, with object storage/CDN used for title art and future binary assets.
- Model piece visibility explicitly as `public` or `hidden`, independent from draft state.
- Model title display explicitly, including title art precedence and text-title fallback.
- Model per-piece default reader mode explicitly as `paged` or `continuous`.
- Keep workflow metadata for draft-first save, explicit publish action, and hidden-published behavior.
- Support migration of legacy fields such as tags, thought date, rating, status, and phase when importing existing content.
- Keep export tooling so the content archive remains portable after migration.
- Support hide/unhide published piece actions in the server API.

### UX Design Requirements

UX-DR1: The public experience must keep the reading canvas visible as the dominant surface while browse/discovery remains available without disrupting reading context.

UX-DR2: The browse rail must support search, type filters, tags, ratings-based sorting, and quick piece switching.

UX-DR3: The reading canvas must support title text or title art, multi-page navigation, continuous reading, per-piece default reader mode, and separate creator/community rating display.

UX-DR4: The bottom quick composer must stay visible only for users with create access and must save drafts on `Enter` while exposing a separate publish button.

UX-DR5: The expanded editor must support plain text, Markdown, HTML, rich styling controls, page-break insertion, title styling, and title-art upload.

UX-DR6: The system must support content states `draft`, `published`, and `hidden-published` in the authenticated workflow.

UX-DR7: The authoring workflow must include hide published content, choose per-piece default reader mode, and choose whether title art or text title is displayed.

UX-DR8: The reader flow must open directly into the configured default mode for each piece and allow mode switching when both views are supported.

UX-DR9: Keyboard navigation, high contrast, title-art fallback metadata, and readable styled-content constraints must be preserved across reader and editor experiences.

### FR Coverage Map

FR-1: Epic 1 - Reader shell keeps a persistent reading surface active.

FR-2: Epic 1 - Reader shell supports unified browse, search, filter, and reading flow.

FR-3: Epic 1 - Migrated library and new content model support poem, article, song, and diary types.

FR-4: Epic 1 - Discovery interactions allow quick switching between pieces without leaving the reader.

FR-5: Epic 1 - Reader supports explicit page navigation within a piece.

FR-6: Epic 1 - Reader supports continuous rendering where configured.

FR-7: Epic 2 - Authenticated creators get the bottom quick composer.

FR-8: Epic 2 - Quick composer supports low-friction short-form drafting.

FR-8a: Epic 2 - `Enter` saves a draft.

FR-8b: Epic 2 - Separate publish action is available beside save.

FR-9: Epic 2 - Expanded editor supports structured content creation.

FR-10: Epic 3 - Editing modes support plain text, Markdown, and sanitized HTML.

FR-11: Epic 3 - Existing Markdown and HTML content is directly editable.

FR-12: Epic 3 - Rich content styling is available for arbitrary body ranges.

FR-13: Epic 3 - Rich title styling is available.

FR-14: Epic 3 - Title art can be uploaded and assigned.

FR-15: Epic 3 - Page breaks can be inserted, removed, and reordered.

FR-16: Epic 2 - Content supports draft and published lifecycle states.

FR-16a: Epic 2 - Drafts remain private.

FR-16b: Epic 2 - Published pieces can be hidden without becoming drafts.

FR-17: Epic 4 - Creator ratings are supported and displayed.

FR-18: Epic 4 - Any logged-in user can rate content.

FR-19: Epic 4 - Creator and reader rating aggregates are stored and exposed separately.

FR-20: Epic 4 - Users can update prior ratings.

FR-21: Epic 5 - rhymes-specific memberships are introduced.

FR-22: Epic 5 - Admins can assign rhymes roles in an admin surface.

FR-23: Epic 5 - Piece-level edit access is configurable.

FR-24: Epic 5 - Revision history and auditability are preserved.

FR-25: Epic 1 - Existing markdown corpus is imported into the new platform.

FR-26: Epic 1 - Imported plain text and Markdown render accurately in the new reader.

## Epic List

### Epic 1: Reader foundation and library migration
Readers can use the new rhymes experience immediately with migrated legacy content, inline discovery, and per-piece paged or continuous reading.
**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-25, FR-26

### Epic 2: Authenticated publishing workflow
Creators can sign in, draft quickly, publish intentionally, and manage content visibility without leaving the reader-first workspace.
**FRs covered:** FR-7, FR-8, FR-8a, FR-8b, FR-9, FR-16, FR-16a, FR-16b

### Epic 3: Rich document and title presentation
Creators can shape how each piece looks and reads through multi-mode editing, body styling, title styling, title art, and page-break authoring.
**FRs covered:** FR-10, FR-11, FR-12, FR-13, FR-14, FR-15

### Epic 4: Ratings and reader feedback
Creators and logged-in readers can rate pieces, and the product can surface creator score and reader sentiment separately.
**FRs covered:** FR-17, FR-18, FR-19, FR-20

### Epic 5: Collaboration, permissions, and history
The platform can support multi-author growth through rhymes-specific roles, piece-level edit access, and revision/audit controls.
**FRs covered:** FR-21, FR-22, FR-23, FR-24

## Epic 1: Reader foundation and library migration

Launch the new reader-first rhymes experience with migrated existing content, inline discovery, and reliable paged/continuous reading.

### Story 1.1: Migrate the existing rhymes library into the new content model

As a rhymes owner,
I want the existing markdown library imported into the new platform,
So that the revamp starts with the current corpus already available.

**Acceptance Criteria:**

**Given** the current markdown files in `apps/rhymes/src/assets/rhymes`
**When** the migration/import workflow is run
**Then** each legacy piece is imported as a content record with mapped metadata, body content, and a stable identifier
**And** legacy fields such as type-relevant metadata, tags, dates, rating source, status, and phase are preserved where possible.

**Given** imported content that was authored as plain text or Markdown
**When** it is loaded into the new content model
**Then** the body remains readable without requiring manual reconstruction
**And** import failures are reported with enough detail to fix individual pieces safely.

### Story 1.2: Deliver the new public reader shell with persistent reading canvas

As a public reader,
I want to land on a page that already shows a readable work,
So that I can begin reading immediately without drill-down navigation.

**Acceptance Criteria:**

**Given** a visitor opens rhymes
**When** the initial page loads
**Then** a selected published piece is visible in the main reading canvas
**And** the shell uses the intended off-black/off-white literary theme with accessible contrast.

**Given** the reader shell is visible
**When** the user browses discovery controls
**Then** the reading canvas remains present and readable
**And** the interface does not force a separate detail-page transition for normal reading.

### Story 1.3: Add inline discovery with search, filters, and piece switching

As a public reader,
I want to search and filter the library while staying in the reading flow,
So that I can move between relevant works quickly.

**Acceptance Criteria:**

**Given** published content exists across poems, articles, songs, and diaries
**When** a reader uses search, type filters, tags, or sort controls
**Then** the browse rail updates to reflect matching content
**And** switching to another piece updates the reading canvas without losing context.

**Given** discovery controls are used repeatedly
**When** the reader changes results
**Then** the interface remains responsive as the library grows
**And** ratings-aware sorts can be layered in later without redesigning the discovery model.

### Story 1.4: Render page-aware and continuous reading per content piece

As a public reader,
I want each piece to open in the reading mode chosen for that piece,
So that poems, articles, songs, and diaries can each feel right for their structure.

**Acceptance Criteria:**

**Given** a piece has explicit page breaks and a configured default reader mode
**When** the reader opens that piece
**Then** the piece opens in its configured default mode, either paged or continuous
**And** the reader can move between pages when the piece is paged.

**Given** a piece supports both paged and continuous views
**When** the reader switches modes
**Then** the same underlying content remains intact
**And** the current reading position is preserved as reasonably as possible.

### Story 1.5: Respect public visibility rules for published and hidden content

As a public reader,
I want to see only content meant for public reading,
So that hidden or draft pieces never leak into the public experience.

**Acceptance Criteria:**

**Given** the content store contains drafts, public published pieces, and hidden published pieces
**When** a public reader browses rhymes
**Then** only public published pieces are included in browse results and direct reader surfaces
**And** drafts and hidden pieces are excluded from public discovery.

**Given** a hidden or draft piece is requested by a public user
**When** the reader route or fetch is evaluated
**Then** the system denies public access safely
**And** does not expose private metadata in the response payload.

## Epic 2: Authenticated publishing workflow

Creators can sign in, create quickly, save drafts by default, publish on purpose, and manage public versus hidden visibility from the same reader-first product.

### Story 2.1: Add authenticated creator access and rhymes workspace gating

As a rhymes creator,
I want the product to recognize my signed-in access level,
So that authoring controls appear only when I am allowed to use them.

**Acceptance Criteria:**

**Given** a user is not signed in or lacks rhymes create access
**When** they use the public reader
**Then** authoring controls remain hidden
**And** public reading still works normally.

**Given** a signed-in user has rhymes create access
**When** they open rhymes
**Then** the authenticated workspace augments the same reader shell with creator controls
**And** access checks use rhymes-specific membership data rather than global-only role assumptions.

### Story 2.2: Support draft-first quick composer creation

As a rhymes creator,
I want the bottom composer to save a draft when I press `Enter`,
So that I can capture new writing quickly without accidentally publishing it.

**Acceptance Criteria:**

**Given** a creator with create access is in the authenticated workspace
**When** they enter short-form content in the bottom composer and press `Enter`
**Then** a new draft content piece is created
**And** the new draft is associated with the creator and current workspace context.

**Given** the quick composer creates a draft
**When** the save succeeds
**Then** the UI confirms the draft state clearly
**And** the draft is never exposed publicly as part of that save action.

### Story 2.3: Expose direct publish action beside save

As a rhymes creator,
I want a separate publish button beside the save action,
So that I can intentionally publish without changing the safe draft-first default.

**Acceptance Criteria:**

**Given** a creator is using the quick composer or an eligible draft
**When** they use the publish action
**Then** the piece transitions to published state only after passing required validation
**And** the save-draft action remains separate and unchanged.

**Given** a publish action succeeds
**When** the piece becomes public
**Then** the reader and discovery layers can include it immediately if visibility is public
**And** publishing is recorded with user attribution and timestamp metadata.

### Story 2.4: Provide expanded editor for structured piece management

As a rhymes creator,
I want an expanded editor for longer or more structured work,
So that I can manage content type, body, title, and visibility in one place.

**Acceptance Criteria:**

**Given** a creator opens the expanded editor from a draft or existing piece
**When** the editor loads
**Then** the creator can set content type, update body/title content, and view current publication state
**And** the editor supports both creating new content and updating existing content.

**Given** the editor is used for a published or draft piece
**When** changes are saved
**Then** the piece state remains explicit
**And** the editor can continue working without forcing the creator out of the reader-first workspace.

### Story 2.5: Manage hidden-published visibility without reverting to draft

As a rhymes creator,
I want to hide a published piece without turning it back into a draft,
So that I can temporarily remove it from public view while preserving publication history.

**Acceptance Criteria:**

**Given** a piece is already published
**When** an authorized creator or admin marks it hidden
**Then** the piece remains published in lifecycle terms but is removed from public discovery and public reading
**And** the hidden state is visible in authenticated management views.

**Given** a hidden-published piece should return to public view
**When** an authorized creator or admin unhides it
**Then** it becomes publicly readable again without losing prior ratings, publication metadata, or revision history.

## Epic 3: Rich document and title presentation

Creators can choose how each piece is authored and presented, including source mode, rich styling, title styling, title art, and explicit page-break control.

### Story 3.1: Support plain text, Markdown, and HTML editing modes

As a rhymes creator,
I want to work in plain text, Markdown, or HTML,
So that I can use the authoring mode best suited to the piece and my editing style.

**Acceptance Criteria:**

**Given** a creator opens the expanded editor
**When** they choose a source mode
**Then** the editor supports plain text, Markdown, and HTML as valid editing modes
**And** existing Markdown or HTML content can be reopened and modified directly.

**Given** HTML content is authored or edited
**When** it is saved for public rendering
**Then** the system sanitizes the rendered result
**And** unsafe markup is blocked without corrupting valid author intent.

### Story 3.2: Add rich inline body styling controls

As a rhymes creator,
I want to style specific parts of the body text,
So that I can control emphasis and presentation within a piece.

**Acceptance Criteria:**

**Given** a creator selects a body range in the expanded editor
**When** they apply a style
**Then** text color, background color, font family, and font size can be assigned to that range
**And** the styled result persists through save, reload, and public rendering.

**Given** styled content is displayed publicly
**When** the piece is rendered
**Then** readability constraints and accessibility fallbacks are still respected
**And** illegible combinations can be prevented or warned about by the editor.

### Story 3.3: Add title styling and title-art display rules

As a rhymes creator,
I want to style the title and optionally use title art,
So that I can choose the right presentation for each piece.

**Acceptance Criteria:**

**Given** a creator is editing a piece title
**When** they apply styles
**Then** text color, background color, font family, and font size can be set for the title
**And** the title style persists through save, reload, and public rendering.

**Given** a creator uploads title art
**When** they choose title-art display
**Then** title art takes precedence in the visible reader surface
**And** the text title remains stored as the accessibility and fallback title.

**Given** a creator prefers text-title display
**When** they select that display preference
**Then** the reader shows the styled text title
**And** the title-art asset remains available for later use without forcing display.

### Story 3.4: Author and manage explicit page breaks

As a rhymes creator,
I want to insert and reorder page breaks,
So that I can control how a piece is segmented for reading.

**Acceptance Criteria:**

**Given** a creator is editing a long or structured piece
**When** they insert page breaks
**Then** the content model stores them explicitly
**And** the reader can honor them in paged mode.

**Given** a creator reorders or removes page breaks
**When** the piece is saved
**Then** the page sequence updates correctly
**And** no unrelated content formatting is lost.

### Story 3.5: Configure default reader mode per content piece

As a rhymes creator,
I want to choose whether each piece opens paged or continuous,
So that each work can present itself in the most suitable form.

**Acceptance Criteria:**

**Given** a piece supports both paged and continuous rendering
**When** the creator sets a default reader mode
**Then** that preference is stored on the piece record
**And** public readers open into that configured mode by default.

**Given** a piece has no meaningful page segmentation
**When** the creator selects continuous mode
**Then** the reader defaults to continuous display
**And** the mode selection is independent of the piece's content type.

## Epic 4: Ratings and reader feedback

Creators and logged-in readers can express sentiment numerically, and rhymes can surface both creator intent and community response without confusing the two.

### Story 4.1: Capture and display creator ratings

As a rhymes creator,
I want to rate my own piece,
So that readers can see my intended or reflective score alongside the work.

**Acceptance Criteria:**

**Given** a creator is editing or managing a piece
**When** they set a rating from 0 to 10
**Then** the value is stored as the creator rating for that piece
**And** the reader surface can display it separately from community ratings.

**Given** the creator changes their rating later
**When** the update is saved
**Then** the new creator rating replaces the old one
**And** reader aggregate metrics remain unaffected except where displayed comparatively.

### Story 4.2: Allow any logged-in user to rate and update ratings

As a logged-in reader,
I want to rate a piece and revise my score later,
So that my view of a work can be reflected over time.

**Acceptance Criteria:**

**Given** a reader is logged in
**When** they view a published public piece
**Then** they can submit a rating from 0 to 10
**And** the system records that rating against the user's identity.

**Given** the same reader has already rated the piece
**When** they submit a different rating
**Then** the previous rating is updated rather than duplicated
**And** the revised score is reflected in aggregate calculations.

### Story 4.3: Surface aggregate reader ratings in reader and discovery flows

As a public or logged-in reader,
I want to see community rating information clearly,
So that I can understand how the audience responds to a piece without confusing it with the creator's own rating.

**Acceptance Criteria:**

**Given** a piece has one or more reader ratings
**When** it is shown in the reader or discovery UI
**Then** the average reader rating and rating count are available for display
**And** creator rating remains visually distinct from community aggregates.

**Given** discovery uses rating-aware sorting or filtering
**When** the reader applies those controls
**Then** the product can sort using the stored aggregate values
**And** the behavior stays responsive as rating volume grows.

## Epic 5: Collaboration, permissions, and history

The platform can expand beyond a single author while preserving control over who can create, edit, manage roles, and review change history.

### Story 5.1: Introduce rhymes-specific memberships and workspace roles

As a rhymes admin,
I want rhymes to manage its own roles separate from global platform roles,
So that I can grow the contributor base without over-privileging users across the whole monorepo.

**Acceptance Criteria:**

**Given** the rhymes workspace has authenticated users
**When** memberships are configured
**Then** rhymes-specific roles such as owner, admin, editor, contributor, and viewer are stored independently from global auth roles
**And** the workspace can use those roles for access decisions.

**Given** a user has no rhymes membership
**When** they sign in
**Then** they can still read public content
**And** they do not receive creator/admin controls by default.

### Story 5.2: Manage rhymes roles from an admin people surface

As a rhymes admin,
I want to assign rhymes admin or editor access from a management surface,
So that I can manage who is allowed to create and administer content.

**Acceptance Criteria:**

**Given** a rhymes admin opens the people/settings surface
**When** they review user entries
**Then** they can assign or update rhymes-specific roles for eligible users
**And** role changes are saved with user attribution.

**Given** a role change is made
**When** the affected user next loads rhymes
**Then** their visible controls and permissions reflect the updated role
**And** unauthorized capabilities are not exposed.

### Story 5.3: Grant piece-level edit access

As a rhymes admin or owner,
I want to grant edit access on specific pieces,
So that contributors can work on assigned content without broad workspace ownership.

**Acceptance Criteria:**

**Given** a piece exists and a user is eligible for collaboration
**When** an authorized admin/owner grants piece-level edit access
**Then** that user can edit the assigned piece within the allowed scope
**And** unrelated pieces remain protected by default.

**Given** piece-level access is revoked
**When** the affected user reloads or attempts to edit
**Then** editing capability for that piece is removed
**And** prior revisions remain attributed accurately.

### Story 5.4: Preserve revision history and audit metadata

As a rhymes admin or owner,
I want changes and critical actions to be traceable,
So that collaborative editing remains safe and recoverable.

**Acceptance Criteria:**

**Given** a creator or editor saves changes, publishes, hides, unhides, or updates permissions
**When** the action completes
**Then** the system records the acting user and relevant timestamps
**And** the piece retains enough revision history to support future review or rollback tooling.

**Given** a collaborative editing issue occurs
**When** an admin inspects piece history
**Then** they can identify who changed what and when
**And** the history model supports future revision-browsing features without schema redesign.
