# Architecture — rhymes

**Type:** web  
**Path:** `apps/rhymes`  
**Port:** 3003

## Executive Summary

Standalone SvelteKit reader for a markdown corpus. No auth, no shared DB. Revamp (DB-backed authoring, memberships) is specified in this folder’s `planning-artifacts/` — treat the current app as the brownfield baseline.

## Technology Stack

SvelteKit 2, Svelte 5, Tailwind 4, `gray-matter`, `marked`. No `@pocket-dimension/*` runtime deps.

## Architecture Pattern

Build-time Vite glob of `src/assets/rhymes/*.md` → `loadRhymes.ts` / `parseRhymes()` → two routes (`/`, `/[slug]`). Client filter store + URL query.

## Data Architecture

File corpus (~167 pieces). Frontmatter: title, dates, rating, tags, status, visibility, content_type, reader_mode. Draft/hidden excluded. Pages split on `\n---\n`. Future source of truth: database (see `planning-artifacts/architecture.md`).

## API Design

No `+server.ts` APIs.

## Component Overview

`RhymesShell`, `RhymeSelector` (library + reader), `FilterSort`. No shadcn kit.

## Existing planning

- `planning-artifacts/prds/prd-rhymes-revamp-2026-06-20/`
- `planning-artifacts/architecture.md`
- `planning-artifacts/ux-designs/ux-rhymes-revamp-2026-06-20/`
- `planning-artifacts/epics.md`
- `implementation-artifacts/` stories

## Deployment

`apps/rhymes/DEPLOY.md` and `apps/rhymes/README.md`.

## Testing

None.
