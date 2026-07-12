# Epic 10 — Game mode shell and real-time sync (G1)

**Status:** complete  
**Date:** 2026-07-12

## Stories

### 10.1 — Game database schema and migrations ✅
- Drizzle tables: `game_sessions`, `game_teams`, `game_participants`, `game_rounds`, `game_suggestions`, `game_suggestion_votes`, `room_scores`
- Enums: `game_type`, `game_session_status`, `game_round_phase`, `game_verdict`
- Migration `0030_zeo_game_mode.sql` with partial unique index for one active session per room

### 10.2 — Game server modules and snapshot builder ✅
- `lib/server/game/snapshot.ts`, `authz.ts`, `sessions.ts`, `teams.ts`, `event-bus.ts`, `sse.ts`
- Unit test for empty-session snapshot shape

### 10.3 — SSE event bus and events endpoint ✅
- `GET /api/rooms/[slug]/game/events` — snapshot on connect, ping every 30s

### 10.4 — Game session start/end API ✅
- `POST/GET/DELETE /api/rooms/[slug]/game`

### 10.5 — Client game state store (SSE) ✅
- `lib/call/game-state.ts` with reconnect backoff and discovery poll

### 10.6 — Game Mode control bar button and panel shell ✅
- `GamePanel.svelte` (Setup | Scoreboard tabs)
- `ControlBar.svelte` game button; `G` keyboard shortcut

### 10.7 — Game view layout mode ✅
- `StageLayoutMode` += `"game"`
- `game-layout.ts` placeholder team columns
- Grid settings locked during active game
