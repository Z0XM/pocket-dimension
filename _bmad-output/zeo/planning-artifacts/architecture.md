# zeo architecture

## 1. Overview

**zeo** is a SvelteKit application in the Pocket Dimension monorepo that provides authenticated group video calling with screen sharing. Media is handled by a self-hosted **LiveKit SFU** deployed via Docker on the user's Hostinger KVM 2 VPS. Application logic enforces capacity limits (2 concurrent rooms, 6 participants per room) before issuing LiveKit access tokens.

This document captures technical decisions for consistent implementation across app, shared packages, and deployment.

## 2. System context

```mermaid
flowchart TB
  subgraph clients [Browser clients]
    C1[Participant]
    C2[Participant]
  end

  subgraph monorepo [Pocket Dimension monorepo]
    ZEO[apps/zeo SvelteKit]
    AUTH_PKG[@pocket-dimension/auth]
    DB_PKG[@pocket-dimension/db]
  end

  subgraph vps [Hostinger KVM 2]
    CADDY[Caddy reverse proxy]
    LK[LiveKit Server]
    TURN[coturn optional]
    PG[(PostgreSQL 18)]
    AUTH_SVC[auth-service :5001]
  end

  C1 -->|HTTPS| CADDY
  C2 -->|HTTPS| CADDY
  CADDY --> ZEO
  CADDY -->|WSS| LK
  ZEO --> AUTH_PKG
  ZEO --> DB_PKG
  ZEO --> PG
  ZEO -->|mint token| LK
  ZEO --> AUTH_SVC
  LK -->|webhooks| ZEO
  C1 <-->|WebRTC| LK
  C2 <-->|WebRTC| LK
  C1 -.->|fallback| TURN
  LK --- TURN
```

## 3. Recommended platform direction

### 3.1 Application framework

**SvelteKit 2** with Bun, matching `apps/watchlist`, `apps/chhan-chhan`, etc.

- Port **3008** for local dev
- Package name: `@pocket-dimension/zeo`
- Adapter: Node or Bun for VPS deployment behind Caddy

### 3.2 Media layer

**LiveKit Server** (Apache 2.0) — not custom WebRTC mesh.

Reasons:
- SFU required for 6-person groups
- Screen share is first-class
- Webhooks for participant sync
- Single-binary Docker deploy fits KVM 2

Client: `livekit-client` npm package; UI components adapted for Svelte (no official Svelte component library — wrap or build thin components).

### 3.3 Authentication

Reuse **Better Auth** via `@pocket-dimension/auth` and central **auth-service**.

- Protected routes under `(protected)/`
- Server-side session check before token mint API
- Participant identity in LiveKit token = authenticated `user.id`
- Display name from user profile or email local-part fallback

### 3.4 Database

PostgreSQL schema **`zeo`** via Drizzle in `@pocket-dimension/db`.

## 4. Domain model

### 4.1 `zeo.rooms`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default uuidv7() |
| slug | text | unique, URL-safe, non-guessable |
| livekit_room_name | text | unique, typically UUID |
| display_name | text | user-facing room title |
| host_user_id | uuid | FK → auth.users |
| status | enum | `waiting`, `active`, `ended` |
| max_participants | int | default 6, enforced in app |
| created_at | timestamptz | |
| ended_at | timestamptz | nullable |
| created_by_id | uuid | audit |
| updated_by_id | uuid | audit |

### 4.2 `zeo.room_participants` (audit / reconciliation)

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| room_id | uuid | FK |
| user_id | uuid | FK; nullable for guests |
| guest_display_name | text | nullable; set when user_id null |
| is_guest | boolean | default false |
| joined_at | timestamptz | |
| left_at | timestamptz | nullable |
| removed_by_id | uuid | nullable, host remove |

LiveKit is source of truth for *live* presence; this table is audit trail and lobby count hint.

### 4.3 Phase 2: `zeo.chat_messages`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | |
| room_id | uuid | |
| sender_user_id | uuid | |
| body | text | sanitized |
| created_at | timestamptz | |

## 5. API design

### 5.1 REST / form actions (SvelteKit)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `POST /api/rooms` | POST | contributor/admin session | Create room; enforce global room cap |
| `GET /api/rooms/[slug]` | GET | public | Room metadata + live participant count |
| `POST /api/rooms/[slug]/token` | POST | session **or** guest body | Mint LiveKit JWT; enforce participant cap |
| `POST /api/rooms/[slug]/end` | POST | host session | Host ends room |
| `POST /api/rooms/[slug]/remove` | POST | host session | Host removes participant |
| `POST /api/webhooks/livekit` | POST | LiveKit signature | LiveKit event webhook |

### 5.2 Token mint flow

```
1. If authenticated: validate session; identity = user.id, name = profile
   If guest: require guestName in body; identity = guest_<uuid>, rate-limit by IP
2. Load room by slug; reject if ended
3. (Create only) Verify role ∈ {contributor, admin}
4. Count active rooms — reject create if ≥ 2
5. Count LiveKit participants — reject if ≥ 6
6. Build AccessToken with roomName, identity, name, TTL 4h
7. Return { token, wsUrl, roomName }
```

### 5.3 Capacity counting strategy

**Hybrid:**
- **Room slot:** DB count where `status IN ('waiting','active')` and `ended_at IS NULL`
- **Participant slot:** in-memory/Redis counter updated by LiveKit webhooks (`participant_joined`, `participant_left`) with TTL; fallback to LiveKit RoomService API on token request

For MVP without Redis: query LiveKit API on each token request (acceptable at 12 max participants).

## 6. LiveKit configuration (KVM 2)

```yaml
# livekit.yaml (illustrative)
port: 7880
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
room:
  max_participants: 6
  empty_timeout: 300
turn:
  enabled: true
```

Environment variables in zeo app:
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `LIVEKIT_URL` → public `wss://zeo-livekit.z0xm.com`
- `ORIGIN` → `https://zeo.z0xm.com`
- `LIVEKIT_WEBHOOK_SECRET`

## 7. Deployment architecture

### 7.1 Docker Compose (VPS)

Services:
- `caddy` — TLS for zeo.z0xm.com + zeo-livekit.z0xm.com
- `livekit` — official image
- `coturn` — optional if not using LiveKit embedded TURN
- `zeo` — built SvelteKit container or systemd + bun
- `postgres` — if not host-level PG
- `auth-service` — may already run on same VPS

### 7.2 Firewall (Hostinger + ufw)

Open:
- 443/tcp (HTTPS)
- 7881/tcp (LiveKit ICE TCP)
- 50000-60000/udp (LiveKit media)
- 3478 udp/tcp, 5349, 49152-65535 udp (TURN if coturn)

### 7.3 Monorepo dev workflow

Local dev:
- LiveKit via Docker on localhost
- zeo `bun run dev:app:zeo`
- auth-service + PostgreSQL required for full flow
- Document localhost cookie caveat (secure cookies) from AGENTS.md

## 8. Client architecture (SvelteKit)

```
apps/zeo/src/
  routes/
    (auth)/          # shared auth pages
    (protected)/
      +page.svelte   # home — create room
      room/[slug]/
        +page.svelte # lobby + call (state machine)
  lib/
    livekit/
      room-client.ts    # connect, disconnect, track handlers
      media-controls.ts # mic, cam, screen share
    server/
      livekit-token.ts  # server-only token mint
      capacity.ts       # limit checks
  components/
    VideoGrid.svelte
    ControlBar.svelte
    PreCallLobby.svelte
    ParticipantTile.svelte
```

State machine for `/room/[slug]`:
`loading → lobby → connecting → in_call → reconnecting → ended`

## 9. Security decisions

| Concern | Decision |
|---------|----------|
| Room slug entropy | min 12 char random segment; UUID livekit room name |
| Token scope | room join only; no admin grants in client token |
| Webhook verification | LiveKit signature validation on all webhook POSTs |
| API rate limit | token endpoint: 10/min per user (Phase 1 simple in-memory) |
| CORS | zeo origin only for API |
| Remove participant | server calls LiveKit RemoveParticipant API |

## 10. Observability

- Structured JSON logs: `room.create`, `room.end`, `token.mint`, `capacity.reject`, `webhook.participant_joined`
- Health check: `GET /health` includes LiveKit reachability ping (optional)
- Phase 3: Prometheus metrics from LiveKit

## 11. Phased technical delivery

| Phase | Deliverables |
|-------|--------------|
| **1** | DB schema, app scaffold, LiveKit docker, token API (auth + guest), role-gated create, basic call UI, capacity limits, deploy docs |
| **2** | Webhooks, chat, device picker, waiting room |
| **3** | Admin routes, Egress recording, scheduled rooms |

## 12. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| CPU throttling on long calls | Cap resolution; limit screen share fps; monitor Hostinger |
| LiveKit/webhook desync | Reconcile via LiveKit API before token mint |
| localhost auth cookies | Document; use HTTPS dev proxy or DB verify for local |
| Safari screen share quirks | Test early; document browser requirements |

## 13. Resolved decisions

- Room creation: `contributor` | `admin` only (`auth.users.role`)
- Guest join: MVP, no login, display name required
- Production: zeo.z0xm.com, zeo-livekit.z0xm.com

## 14. Open technical questions

1. Bun vs Node adapter for production SvelteKit on VPS?
2. Co-locate LiveKit on same VPS as zeo app or separate subdomain only?
3. Redis worth adding at Phase 1 for participant counts or defer?
