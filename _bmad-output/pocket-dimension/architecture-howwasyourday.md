# Architecture — howwasyourday

**Type:** web  
**Path:** `apps/howwasyourday`  
**Port:** 3004

## Executive Summary

Authenticated daily journal (one row per user per `day_int` in the current year). Home is a year calendar plus public notes/drawings. Optional VAPID push reminders. `/qna` is a public static question browser.

## Technology Stack

SvelteKit 2, Svelte 5, Tailwind 4, Drizzle, Better Auth, `web-push`, `node-cron`.

## Architecture Pattern

Protected route group + form action on `/day/[dayInt]`. Hooks start a process-local notification scheduler (not a separate worker).

## Data Architecture

Schema `howwasyourday`: `day_data.metadata` JSON (rating, emoji, color, notes, drawing). `push_subscription` for reminders.

## API Design

See [api-contracts-howwasyourday.md](./api-contracts-howwasyourday.md).

## Component Overview

See [component-inventory-howwasyourday.md](./component-inventory-howwasyourday.md).

## Deployment

`apps/howwasyourday/DEPLOY.md`. Needs `PUBLIC_VAPID_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

## Testing

None.
