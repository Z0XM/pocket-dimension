# Architecture — me-via-you

**Type:** web  
**Path:** `apps/me-via-you`  
**Port:** 3006

## Executive Summary

Authenticated users create classified question forms and share `/f/{slug}`. Anyone can answer. Owners see answers on `/u/{username}` and can close or hide forms.

## Technology Stack

SvelteKit 2, Svelte 5, Tailwind 4, bits-ui, Drizzle, Better Auth, `bad-words`.

## Architecture Pattern

Form actions for all writes. Public profile/answer routes; `(protected)` for form detail. Authz helpers in `src/lib/server/authz.ts`.

## Data Architecture

Schema `meviayou`: `forms`, `answers`. See [data-models.md](./data-models.md).

## API Design

See [api-contracts-me-via-you.md](./api-contracts-me-via-you.md).

## Component Overview

See [component-inventory-me-via-you.md](./component-inventory-me-via-you.md).

## Deployment

`apps/me-via-you/DEPLOY.md`.

## Testing

None.
