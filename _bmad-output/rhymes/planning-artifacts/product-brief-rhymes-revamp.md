# Product Brief: rhymes revamp

## Executive Summary

`rhymes` is a literary publishing experience for writing and reading poems, articles, songs, and diaries. The current site already hints at the right public behavior: readers can browse and keep the selected work visible on the same page. The revamp should preserve that reader-first principle while rebuilding the product into a proper publishing platform with richer content formatting, admin authoring, permissions, ratings, and future multi-author support.

This revamp is not just a redesign. It is the transformation of a static markdown reader into a content platform that supports live creation, collaborative growth, richer presentation, and more intentional reading behavior. The product must feel calm and literary on the outside, but efficient and powerful on the inside for creators.

## The Problem

The current rhymes app is easy to browse relative to a traditional blog, but it is still limited by a repo-backed markdown workflow, no authentication, no admin writing interface, no formal permissions, and no scalable content model for multiple contributors. It also lacks a real structured system for page breaks, rich text styling, title art, and user ratings.

For readers, the risk is losing the best part of the current experience if the site becomes a conventional list-plus-detail blog. For creators, the risk is the opposite: the current model is too static and too manual to support quick capture, iterative edits, or future contributor workflows.

## The Solution

`rhymes` should become a reader-first publishing platform with a persistent reading canvas, strong inline discovery, and a fast creator workflow. The public interface should let a reader browse and read without unnecessary page transitions. The authenticated interface should let admins and future contributors create, edit, style, page-break, rate, and publish content quickly.

The product should support content as structured documents rather than only raw markdown files. That allows page-aware rendering, mixed authoring modes, styling of partial text ranges, formatted titles, and optional title art. The system should also support both creator ratings and community ratings.

The default authoring posture should be safe and fast: quick-composer submissions save as drafts by default, while a separate publish action allows immediate release when desired. Drafts are never public. Published content is public by default, but creators/admins can hide it. Reading mode should be chosen per piece rather than by content type, and title art should take precedence whenever the creator chooses to show it while the text title remains the fallback.

## What Makes This Different

- It is optimized for literary reading rather than blog chronology.
- It treats fast authoring as a primary product goal, not a back-office CMS concern.
- It supports expressive presentation for text itself, including page breaks and styled spans.
- It is designed from the start for eventual multi-author growth without losing the personal feel of the original project.

## Who This Serves

### Primary users
- The owner/author who wants to publish quickly, edit freely, and retain expressive control over how writing appears.
- Readers who want low-friction browsing and immediate access to the full work, not a title list with repeated drill-down steps.

### Secondary users
- Future contributors invited to create or edit content.
- Logged-in community members who can rate content and participate in lightweight engagement loops.

## Success Criteria

- Readers can discover and start reading any piece with minimal navigation cost.
- Admins can add a short piece from a bottom composer in seconds.
- Styled text, title formatting, page breaks, and title art work consistently across content types.
- The platform supports at least the first step of multi-author collaboration without re-architecting later.
- The revamp preserves importability of the existing corpus while moving toward a more scalable source of truth.

## Scope

### In scope for the revamp foundation
- New reader-first layout and information architecture.
- Content types: poem, article, song, diary.
- Authenticated authoring and edit permissions.
- Rich content model with plain text, Markdown, and sanitized HTML support.
- Inline formatting controls for text and titles.
- Page break support.
- Title art / cover image support.
- Ratings by creators and logged-in users.
- Draft-first quick capture with separate publish control.
- Hidden-published visibility support.
- Per-piece default reader mode selection.
- Multi-author-ready data model and role model.

### Explicitly deferred
- Repeating uploaded page background images across rendered pages.
- Broader social features beyond ratings.
- Audio/media features for songs unless added in a later phase.

## Vision

If this revamp succeeds, `rhymes` becomes a modern literary home: part reading room, part personal notebook, part collaborative publishing space. It should be able to start as a deeply personal archive and grow into a curated multi-author platform without losing speed, intimacy, or stylistic control.
