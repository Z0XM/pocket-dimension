# Story 7.1: In-room text chat

**Epic:** 7 — Chat, devices, and waiting room  
**Status:** done

## Acceptance criteria

- [x] FR-36: messages scoped to room; sanitized; scrollable panel

## Implementation

- DB: `zeo.chat_messages` table (migration 0025)
- `POST/GET /api/rooms/[slug]/chat` — send + poll messages
- `lib/server/chat.ts` — HTML strip, length cap, persistence
- `ChatPanel.svelte` — scrollable side panel with 2.5s polling
