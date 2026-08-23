# Architecture — pocket

**Type:** web  
**Path:** `apps/pocket`  
**Port:** 3007

## Executive Summary

Hub that renders cards for sibling apps whose URL env vars are set. No auth, no DB, no proxy.

## Technology Stack

SvelteKit 2, Tailwind 4, `@pocket-dimension/utils`.

## Architecture Pattern

`getLinkedApps()` in `src/lib/server/env.ts` filters `src/lib/apps.ts` catalog by env.

## Catalog

`watchlist`, `rhymes`, `howwasyourday`, `chhan-chhan`, `me-via-you`, `markitdown`, `zeo`.

Each appears only when its `POCKET_APP_*_URL` env var is set.

## API Design

`GET /health` → `{ status: "ok" }`.

## Component Overview

`app-card.svelte` plus page layout.

## Deployment

`apps/pocket/DEPLOY.md`. Set `POCKET_APP_*_URL` per app you want listed.

## Testing

None.
