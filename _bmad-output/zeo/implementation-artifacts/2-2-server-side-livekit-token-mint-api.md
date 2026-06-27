# Story 2.2: Server-side LiveKit token mint API

**Epic:** 2 — LiveKit infrastructure and token service  
**Status:** done

## Acceptance criteria

- [x] `POST /api/rooms/[slug]/token` requires auth session
- [x] Returns `{ token, wsUrl }` with 4-hour TTL max
- [x] Token identity = user id; name = display name
- [x] API keys never exposed to client bundle (server-only env)

## Implementation

- `src/lib/server/env.ts` — `LIVEKIT_*` vars (server-only)
- `src/lib/server/livekit-token.ts` — `AccessToken` mint with 4h TTL
- `src/routes/api/rooms/[slug]/token/+server.ts`

**Note:** Room must exist in DB (Epic 3 creates rooms). Token endpoint returns 404 until then.
