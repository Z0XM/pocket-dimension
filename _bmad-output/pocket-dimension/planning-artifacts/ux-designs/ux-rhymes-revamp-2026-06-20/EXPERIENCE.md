---
title: rhymes UX Experience
status: draft
created: 2026-06-20
updated: 2026-06-20
---

# Foundation

- Product focus: reader-first literary publishing
- Form factors: web first, responsive across desktop and mobile
- Visual identity source: `DESIGN.md`
- Core surfaces:
  - browse/discovery
  - reading
  - authoring
  - permissions/admin

# Information Architecture

## Public reader shell
- Home / primary reading experience
- Search and filters
- Content piece reader
- Optional author/profile views later

## Authenticated creator shell
- Same reading shell, augmented with edit controls when permitted
- Bottom quick composer
- Expanded editor
- Piece management actions
- rhymes people/settings surface for role assignment

# Voice and Tone

- Calm
- literary
- human
- not product-marketing heavy
- minimal interface copy during reading

# Component Patterns

## Browse rail
- Supports search, type filters, tags, ratings-based sorting, and quick switching between pieces.
- Must preserve the selected reader surface while the user browses.

## Reading canvas
- Displays the selected piece immediately.
- Supports:
  - title text or title art
  - styled title
  - multi-page navigation
  - continuous reading when chosen
  - per-piece default mode for paged vs continuous presentation
  - creator rating and community rating display

## Bottom quick composer
- Visible only to users with create access.
- Single-line or compact multiline by default.
- `Enter` saves a draft by default.
- A separate publish button sits beside the save action for direct publishing.
- Expansion path reveals richer controls for type, title, formatting, tags, publish state, and page structure.

## Expanded editor
- Supports:
  - plain text mode
  - Markdown mode
  - HTML mode
  - rich styling controls
  - page-break insertion
  - title styling
  - title art upload

## Ratings control
- Users can assign or update a 0-10 rating when eligible.
- UI distinguishes creator score from reader aggregate.

# State Patterns

## Content piece states
- draft
- published
- hidden-published
- archived later if needed

## Permission states
- public viewer
- logged-in user
- contributor/editor
- rhymes admin

## Editor states
- quick compose
- expanded edit
- preview
- saving
- saved
- publish-ready

# Interaction Primitives

## Reading interactions
- select piece
- next/previous piece
- next/previous page
- switch between paged and continuous mode if enabled

## Authoring interactions
- create from quick composer
- expand to full editor
- edit content body
- edit title styling
- add page break
- upload title art
- save draft
- publish directly
- hide published content
- choose per-piece default reader mode
- choose whether title art or text title is displayed

## Admin interactions
- grant rhymes-specific role
- assign edit access
- manage content ownership

# Accessibility Floor

- Keyboard navigation across browse rail, pages, and editor controls.
- Strong visual contrast in the dark shell.
- Title art requires text fallback/alt-friendly metadata.
- Styled content must not make text illegible by default.
- Paged content must remain screen-reader understandable.

# Key Flows

## Flow 1: Reader opens and starts reading
1. A reader lands on `rhymes`.
2. The reader immediately sees a selected work on the reading canvas.
3. The reader scans the browse rail and switches pieces without losing context.
4. The reader sees the piece in its configured default mode, either continuous or paged.
5. The reader may switch modes when the piece supports both.

## Flow 2: Admin captures a short poem quickly
1. A rhymes admin logs in.
2. The bottom composer is visible immediately.
3. The admin writes a short piece and presses `Enter`.
4. The piece is saved as a draft with minimal friction.
5. The admin can publish immediately using the separate publish button or expand it later for deeper formatting.

## Flow 3: Admin creates a styled multi-page article
1. The admin opens the expanded editor.
2. The admin selects content type `article`.
3. The admin writes in Markdown, HTML, or rich editing mode.
4. The admin inserts page breaks.
5. The admin styles sections and title text, or uploads title art.
6. The admin chooses the default reader mode for that specific piece.
7. The admin previews and saves/publishes.

## Flow 4: Community user rates a piece
1. A logged-in user opens a published piece.
2. The user sees creator rating and reader aggregate separately.
3. The user submits or updates a 0-10 rating.
4. The aggregate updates without disrupting reading.

# Locked UX Decisions

- Quick composer saves drafts by default on `Enter`.
- Publish is exposed as a separate action beside save.
- Drafts are never public.
- Published content can also be hidden.
- Any logged-in user can rate content.
- Reader mode default is configured per piece.
- Creator chooses whether title art or text title is displayed; title art takes precedence and text title remains the fallback.
