# zeo PRD — Addendum

Technical and implementation context that supports the PRD but does not belong in the requirements narrative.

## Stack decisions

| Layer | Choice | Notes |
|-------|--------|-------|
| App | SvelteKit 2 + Bun | `apps/zeo`, port 3008 dev |
| Media SFU | LiveKit Server | Docker on VPS, Apache 2.0 |
| Client SDK | `livekit-client` + `@livekit/components-core` or custom Svelte wrappers | Evaluate official Svelte examples |
| TURN | LiveKit built-in TURN or coturn sidecar | Open UDP 3478, 5349, 49152–65535 |
| Reverse proxy | Caddy recommended | Auto TLS, WebSocket upgrade for LiveKit |
| Auth | `@pocket-dimension/auth` + auth-service | Optional for join; required for create (contributor/admin) |
| Database | Drizzle + PostgreSQL schema `zeo` | Rooms, participants audit, optional chat Phase 2 |

## Role model (room creation)

Uses global Better Auth user role from `auth.users.role`:

| Role | Create room | Join room |
|------|-------------|-----------|
| `admin` | Yes | Yes (authenticated) |
| `contributor` | Yes | Yes (authenticated) |
| `user` | No (403) | Yes (authenticated) |
| Guest (none) | No | Yes (display name + guest token) |

Server check on `POST /api/rooms`:

```typescript
const role = session.user.role;
if (role !== "contributor" && role !== "admin") {
  throw error(403, "Only contributors and admins can create rooms");
}
```

## Production domains

| Service | URL |
|---------|-----|
| zeo app | **https://zeo.z0xm.com** |
| LiveKit WSS | **wss://zeo-livekit.z0xm.com** |

Env vars:

- `PUBLIC_LIVEKIT_URL=wss://zeo-livekit.z0xm.com`
- `ORIGIN=https://zeo.z0xm.com`

## Hostinger KVM 2 deployment topology

```
Internet
   │
   ▼
Caddy (:443)
   ├── zeo.z0xm.com          → SvelteKit (Bun/Node adapter)
   └── zeo-livekit.z0xm.com  → LiveKit (:7880 WS, :7881 TCP)

LiveKit ←→ coturn (optional, same host)
PostgreSQL (local or managed)
auth-service (:5001)
```

## Port plan (production)

| Service | Ports |
|---------|-------|
| zeo app | 3008 (internal), proxied 443 |
| LiveKit | 7880 (WS), 7881 (TCP), 50000–60000 UDP (configurable range) |
| TURN | 3478 UDP/TCP, 5349 TLS, 49152–65535 UDP relay |

## Guest abuse mitigation

- Guest token endpoint shall be rate-limited per IP (e.g. 20/hour) and require valid room slug; display names sanitized.

## Session block on remove

When host removes a participant, insert into `zeo.room_session_blocks` keyed by `(room_id, participant_identity)`. Token mint checks this table; blocked users see: "You were removed from this call." Blocks expire when room status → `ended`.

## Call snapshot (MVP)

- Client-side only — no LiveKit Egress, no recording
- Composite visible `<video>` elements to canvas → PNG blob → browser download
- Optional Phase 2: upload snapshot to object storage with room audit trail

## Guest join security model (MVP)

- Room link format: `https://zeo.z0xm.com/room/[slug]`
- Guest flow: enter display name → `POST /api/rooms/[slug]/token` with `{ guestName }` (no session)
- LiveKit identity: `guest_<uuid>` generated server-side; display name in token metadata
- Rate limit: 20 guest token requests / hour / IP per room
- Sanitize display name (length, strip HTML)
- Guests cannot call create/end/remove APIs
- Optional: mark guest tiles with subtle "Guest" badge in UI

## LiveKit resource tuning (KVM 2)

- `max_participants`: 12 global (2 rooms × 6)
- Video codec: VP8 default for broad browser support; H.264 optional for Safari
- Simulcast enabled; subscriber layer capping at 720p
- Limit simultaneous screen share encoding to 1080p @ 15fps cap

## Monorepo integration checklist

- [ ] Add `apps/zeo` workspace package `@pocket-dimension/zeo`
- [ ] Add `dev:app:zeo` and `build:app:zeo` root scripts
- [ ] Add `zeo` schema to `shared/db`
- [ ] Add `.env.example` for zeo and deployment docs
- [ ] Register in `apps/pocket` hub app (optional Phase 2)

## Alternatives considered

| Option | Why not primary |
|--------|-----------------|
| Jitsi Meet | Heavier JVM stack; less custom UI control |
| mediasoup | More engineering for signaling + UI |
| Pure P2P mesh | Unreliable at 6 participants |
| LiveKit Cloud | Adds cost; user wants self-host |
