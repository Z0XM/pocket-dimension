---
title: rhymes revamp PRD
status: draft
created: 2026-06-20
updated: 2026-06-20
---

# rhymes revamp PRD

## Executive Summary

`rhymes` is the next evolution of the current `apps/rhymes` experience: a literary publishing product for poems, articles, songs, and diaries that keeps reading friction low and creation friction even lower. The current reader-centric behavior should be preserved and strengthened, while the underlying platform evolves from static markdown files into an authenticated, structured, multi-author-ready publishing system.

The first major release of the revamp should establish the new reading layout, the new authoring model, the richer content model, ratings, page breaks, and title-art support. The goal is not only to improve presentation, but to make the platform durable for future contributors and future media features.

## Problem Statement

The current rhymes app has three structural limitations:

1. It is content-source constrained because content lives as markdown files in the repo.
2. It lacks live authoring and permissions, so admin workflows are manual and future contributor workflows are not yet practical.
3. It lacks a document model rich enough for page breaks, styled spans, title art, and community interaction such as user ratings.

At the same time, the product already contains a strong insight worth protecting: the best reading experience for this project is not a list-first blog, but a browse-and-read-in-place canvas.

## Product Goals

### G1. Reader-first literary experience
Readers should be able to browse and begin reading immediately without repeated navigation steps.

### G2. Fast author creation
Admins should be able to quickly capture new content, ideally from a bottom-docked composer with minimal ceremony.

### G3. Rich expressive formatting
Creators should be able to edit content as plain text, Markdown, or HTML and style portions of the content and title with typography and color controls.

### G4. Structured publishing foundation
The system should support permissions, ratings, revisions, and future multi-author growth without a later platform rewrite.

## Users and Roles

### Public reader
- Browses and reads published content.
- May rate content if allowed by final permissions policy.

### Logged-in community user
- Can rate content.
- May gain additional permissions in the future.

### Contributor
- Can create and edit content they own or are assigned.

### rhymes admin
- Can create, edit, publish, manage permissions, and configure rhymes-specific access for users.

## Functional Requirements

### Reading and discovery

#### FR-1 Persistent reader surface
The product shall present a persistent reading surface where the selected content is visible without requiring a separate content-detail route for basic reading.

#### FR-2 Unified browse-and-read flow
The product shall support browsing, filtering, searching, and reading within one continuous experience.

#### FR-3 Content types
The product shall support at least four content types: poem, article, song, and diary.

#### FR-4 Reader navigation modes
The product shall support moving between content pieces quickly from the browse surface without losing reading context.

#### FR-5 Page-based reading
The product shall support content split into explicit pages and allow the reader to move page by page within a content piece.

#### FR-6 Continuous rendering compatibility
The product shall allow the same content model to render in a continuous flow mode when appropriate.

### Content creation and editing

#### FR-7 Quick composer
The product shall show a bottom-docked quick composer for users with create access.

#### FR-8 Fast submit workflow
The quick composer shall support single-action submission behavior optimized for short-form writing.

#### FR-9 Expanded editor
The product shall provide an expanded editor for longer-form and more structured content creation.

#### FR-10 Multi-mode source support
The editor shall support plain text, Markdown, and sanitized HTML authoring.

#### FR-11 Editable existing syntax
Users with edit access shall be able to modify existing Markdown and HTML content directly.

#### FR-12 Inline content styling
Users with edit access shall be able to apply formatting to arbitrary content ranges, including text color, background color, font family, and font size.

#### FR-13 Title styling
Users with edit access shall be able to style titles with text color, background color, font family, and font size.

#### FR-14 Title art support
Users with edit access shall be able to upload and assign a title-art or cover image for a content piece.

#### FR-15 Page-break editing
Users with edit access shall be able to insert, remove, and reorder explicit page breaks inside a content piece.

#### FR-16 Draft and publish states
The system shall support at least draft and published states for content.

### Ratings and interaction

#### FR-17 Creator rating
The system shall allow the creator of a content piece to rate that content from 0 to 10.

#### FR-18 User ratings
The system shall allow eligible blog users to rate content from 0 to 10.

#### FR-19 Aggregate rating views
The system shall store and expose creator rating, user rating summary, rating count, and average rating as separate values where relevant.

#### FR-20 Rating updates
The system shall allow a user to update their prior rating.

### Permissions and collaboration

#### FR-21 rhymes-specific membership
The system shall support rhymes-specific user access separate from any global platform role.

#### FR-22 Admin access management
rhymes admins shall be able to mark a user account as having rhymes admin or editor access through an administrative user-management surface.

#### FR-23 Piece-level edit access
The system shall support granting edit access to specific content pieces.

#### FR-24 Revisionability
The system shall preserve enough document history to support safe editing and future revision browsing.

### Migration and compatibility

#### FR-25 Legacy content import
The system shall support importing the existing markdown corpus from `apps/rhymes/src/assets/rhymes`.

#### FR-26 Backward-readable rendering
The system shall correctly render imported plain text and Markdown content without requiring full manual reconstruction.

## Non-Functional Requirements

### NFR-1 Accessibility
The revamp shall maintain high readability, strong keyboard usability, and sufficient contrast in the monochrome/off-black visual system.

### NFR-2 Performance
The reading experience shall remain responsive even as the content library grows beyond the current corpus size.

### NFR-3 Safety
All user-authored HTML shall be sanitized before public rendering.

### NFR-4 Portability
Content shall remain exportable to durable, non-proprietary formats such as Markdown and/or HTML snapshots.

### NFR-5 Extensibility
The content and asset model shall allow future support for repeating page background images without requiring a full content-model rewrite.

### NFR-6 Auditability
Content writes, permission changes, and publication actions shall be attributable to authenticated users.

## Information Model

### Core content entity
Each content piece shall include:
- stable id
- slug
- content type
- title text and/or title art
- structured body representation
- optional source representation metadata
- page list or page-break markers
- author/owner
- visibility and publish state
- creator rating
- aggregate user rating fields
- tags and other taxonomy fields

### Title model
The title model shall support:
- rich styled text title
- title art / cover image
- accessibility-safe fallback text

### Document model
The document model shall support:
- styled inline spans
- paragraphs/blocks
- explicit page breaks
- future per-page background configuration

## UX Requirements Summary

- The public home experience should default to reading, not to metadata administration.
- Discovery must feel light and immediate.
- The browse surface must not obscure the reading surface.
- Authoring controls must stay hidden for non-editors.
- Editing advanced formatting must not make short-form authoring feel heavy.

## Out of Scope for This Phase

- Repeating uploaded page background images.
- Broad social features beyond ratings.
- Rich media/audio playback requirements for songs.

## Risks and Open Questions

### Open questions
- Should quick composer `Enter` publish or draft by default?
- Can diaries be private or unlisted?
- Which users may rate content?
- What should the default reading mode be for paged vs continuous documents?
- Should title art replace the visible text title or supplement it?

### Primary risks
- Migrating from repo-backed markdown to structured content without losing tone or formatting.
- Preserving the lightweight feel of the current reader while adding richer authoring power.
- Preventing unsafe or inconsistent HTML rendering in a multi-user system.

## Recommended Next BMAD Artifacts

- UX design artifacts (`DESIGN.md` and `EXPERIENCE.md`) for the reading layout and authoring flows.
- Architecture document for the data model, auth integration, migration path, and rendering strategy.
- Epics and stories only after the user resolves the remaining product questions.
