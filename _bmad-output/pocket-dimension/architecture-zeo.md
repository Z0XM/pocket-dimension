# Architecture — zeo

**Type:** web  
**Path:** `apps/zeo`  
**Port:** 3008

## Executive Summary

Self-hosted group video (LiveKit SFU), waiting room, chat, call snapshot, charades shell, YouTube shared listening. Login required to join. Create room: contributor/admin. Limits: 2 rooms × 6 humans, one screen share.

## Do not duplicate planning

Existing pack: `_bmad-output/zeo/project-context.md` and `planning-artifacts/architecture.md`. **Correction vs that architecture:** guest join was removed.

## Technology Stack

SvelteKit 2, LiveKit client/server-sdk, Drizzle, Better Auth, MediaPipe tasks-vision, SSE for game/listening.

## Architecture Pattern

SvelteKit BFF: token mint, occupancy, webhooks, game/listening HTTP+SSE. Browser holds the LiveKit `Room`. Music worker is a separate process.

## Data Architecture

Schema `zeo` — [data-models.md](./data-models.md).

## API Design

[api-contracts-zeo.md](./api-contracts-zeo.md).

## Component Overview

[component-inventory-zeo.md](./component-inventory-zeo.md). Orchestrator: `CallExperience.svelte`.

## State

Call phase FSM (`lobby → waiting_admission → connecting → in_call → …`). Game/listening: writable stores + EventSource. Occupancy: in-memory map + webhooks.

## Deployment

`apps/zeo/DEPLOY.md`, `apps/zeo/deploy/dokploy/README.md`. Prod start: `scripts/start.sh` (migrate then serve).

## Testing

`bun test src` — LiveKit helpers, layout, game snapshot. See explore inventory in scan notes.
