# Epic 9 — Remove guest mode from Zeo

**Status:** complete  
**Date:** 2026-07-12

## Stories

### 9.1 — Require session for LiveKit token mint ✅
- `POST /api/rooms/[slug]/token` uses `requireUser(locals)` → 401 without session
- Removed `guestTokenSchema`, guest rate limit, `generateGuestIdentity`

### 9.2 — Auth gate on room route and lobby ✅
- `/room/[slug]` redirects to `/login?redirect=…` when unauthenticated
- `PreCallLobby.svelte` guest name field removed
- Optional sign-in footer removed from room page

### 9.3 — Remove guest identity from call UI and chat ✅
- `CallExperience.svelte` — no guest state; `user` required prop
- `ParticipantTile.svelte` — guest badge removed
- `VideoGrid.svelte` — no `isGuest` prop
- Chat POST requires session; no `guestIdentity`
- `recordParticipantJoined` always `isGuest: false`, `userId` set

### 9.4 — Update docs ✅
- `AGENTS.md` — zeo login required
- `project-context.md` — guest join removed from access rules
- `deploy/dokploy/README.md` — call test wording

## Files changed (app)

- `apps/zeo/src/routes/api/rooms/[slug]/token/+server.ts`
- `apps/zeo/src/routes/api/rooms/[slug]/chat/+server.ts`
- `apps/zeo/src/routes/room/[slug]/+page.server.ts`
- `apps/zeo/src/routes/room/[slug]/+page.svelte`
- `apps/zeo/src/lib/validation/rooms.ts`
- `apps/zeo/src/lib/server/rooms.ts`
- `apps/zeo/src/lib/server/identity.ts`
- `apps/zeo/src/lib/browser-storage.ts`
- `apps/zeo/src/lib/components/call/CallExperience.svelte`
- `apps/zeo/src/lib/components/call/PreCallLobby.svelte`
- `apps/zeo/src/lib/components/call/ParticipantTile.svelte`
- `apps/zeo/src/lib/components/call/VideoGrid.svelte`
- `apps/zeo/src/lib/components/call/ChatPanel.svelte`
- `apps/zeo/src/lib/components/call/HostWaitingPanel.svelte`
