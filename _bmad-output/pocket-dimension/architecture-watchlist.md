# Architecture — watchlist

**Type:** web  
**Path:** `apps/watchlist`  
**Port:** 3002

## Executive Summary

Public-readable media watchlist (movies/series/shorts) with contributor editing, ratings, saved views, dashboard, and leaderboard. TanStack Table + infinite scroll. Mobile is read-only.

## Technology Stack

SvelteKit 2, Svelte 5, Tailwind 4, bits-ui, `@tanstack/table-core`, Drizzle/Kysely, Better Auth.

## Architecture Pattern

SSR loaders for first paint; REST under `/api/watchlist*` for pagination and mutations. URL query holds filters/sort.

## Data Architecture

Schema `watchlist` — see [data-models.md](./data-models.md). Query builders: `src/lib/server/watchlist.ts`, `dashboard.ts`, `leaderboard.ts`.

## API Design

See [api-contracts-watchlist.md](./api-contracts-watchlist.md).

## Component Overview

See [component-inventory-watchlist.md](./component-inventory-watchlist.md).

## Auth

`hooks.server.ts`: session on all routes; `(protected)` requires verified email; `(auth)` redirects verified users home. Bulk update is role-gated.

## Deployment

`apps/watchlist/DEPLOY.md`. PWA (`static/sw.js`).

## Testing

None.
