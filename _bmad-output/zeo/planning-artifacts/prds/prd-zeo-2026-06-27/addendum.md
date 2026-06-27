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
| Auth | `@pocket-dimension/auth` + auth-service | Same cookie/session caveats as other apps on localhost |
| Database | Drizzle + PostgreSQL schema `zeo` | Rooms, participants audit, optional chat messages Phase 2 |

## Hostinger KVM 2 deployment topology

```
Internet
   │
   ▼
Caddy (:443)
   ├── zeo.example.com     → SvelteKit (Bun/Node adapter)
   └── livekit.example.com → LiveKit (:7880 WS, :7881 TCP)

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

## Phase 2 guest link security model (draft)

- Host generates signed guest token (HMAC, 1-hour TTL, room-scoped)
- Guest enters display name only; no persistent account
- Guest tokens cannot create rooms or exceed participant cap
- Rate limit guest token generation per host
