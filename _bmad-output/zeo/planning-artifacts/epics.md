---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - /workspace/_bmad-output/zeo/planning-artifacts/prds/prd-zeo-2026-06-27/prd.md
  - /workspace/_bmad-output/zeo/planning-artifacts/prds/prd-zeo-2026-06-27/addendum.md
  - /workspace/_bmad-output/zeo/planning-artifacts/architecture.md
  - /workspace/_bmad-output/zeo/planning-artifacts/ux-designs/ux-zeo-2026-06-27/EXPERIENCE.md
  - /workspace/_bmad-output/zeo/planning-artifacts/ux-designs/ux-zeo-2026-06-27/DESIGN.md
---

# zeo — Epic Breakdown

## Overview

Epics and stories for **zeo**, decomposed from the PRD, UX, and Architecture artifacts. Stories are ordered for incremental delivery on Hostinger KVM 2 with LiveKit.

## Requirements Inventory

### Functional Requirements (MVP — Phase 1)

FR-1 through FR-35, FR-10 through FR-19, FR-20 through FR-34 (see PRD).

### Non-Functional Requirements

NFR-1 through NFR-10 (see PRD).

### UX Requirements

UX-DR1: Video grid is the dominant surface; chrome stays minimal during calls.
UX-DR2: Pre-call lobby with explicit Join action and device preview.
UX-DR3: Screen share uses dominant layout + filmstrip pattern.
UX-DR4: Capacity errors use plain language without technical codes.
UX-DR5: Host end-room and remove-participant require confirmation.
UX-DR6: Mute/camera state visible on tiles and control bar (icon + aria).
UX-DR7: Dark minimal aesthetic per DESIGN.md tokens.

---

## Epic 1: Platform scaffold and auth integration

**Goal:** zeo exists as a first-class monorepo app with auth, health check, and deployment skeleton.

### Story 1.1 — Create zeo SvelteKit app workspace

**As a** developer,
**I want** `apps/zeo` scaffolded with SvelteKit and Bun,
**So that** zeo follows monorepo conventions.

**Acceptance criteria:**
- [ ] Package `@pocket-dimension/zeo` exists with `dev`, `build`, `lint`, `typecheck` scripts
- [ ] Root `package.json` includes `dev:app:zeo` and `build:app:zeo`
- [ ] App runs on port **3008** locally
- [ ] `GET /health` returns 200

### Story 1.2 — Integrate shared Better Auth routes

**As an** authenticated user,
**I want** login, sign-up, and password flows,
**So that** I can access zeo with my Pocket Dimension account.

**Acceptance criteria:**
- [ ] Auth routes match sibling apps: login, sign-up, forgot-password, verify-email, check-email
- [ ] `.env.example` documents `BETTER_AUTH_SECRET`, `PUBLIC_BASE_AUTH_URL`, `DATABASE_URL`
- [ ] Protected routes redirect unauthenticated users to login
- [ ] Session available in `+layout.server.ts` for protected shell

### Story 1.3 — Add zeo database schema and migrations

**As a** developer,
**I want** PostgreSQL schema `zeo` with rooms table,
**So that** room metadata persists.

**Acceptance criteria:**
- [ ] Drizzle schema in `shared/db` for `zeo.rooms` per architecture.md
- [ ] Migration applies on PostgreSQL 18
- [ ] Uses uuidv7() default id pattern from common schema

---

## Epic 2: LiveKit infrastructure and token service

**Goal:** LiveKit runs locally and on VPS; server can mint valid join tokens.

### Story 2.1 — LiveKit Docker compose for dev and production

**As an** operator,
**I want** documented Docker Compose for LiveKit,
**So that** media server starts consistently.

**Acceptance criteria:**
- [ ] `apps/zeo/deploy/livekit/docker-compose.yml` (or repo-root `deploy/zeo/`) with LiveKit official image
- [ ] `livekit.yaml` tuned for max 12 participants and port range documented
- [ ] README section: required UDP/TCP ports for Hostinger
- [ ] Dev instructions: start LiveKit locally and connect from app

### Story 2.2 — Server-side LiveKit token mint API

**As an** authenticated participant,
**I want** the server to issue a short-lived join token,
**So that** I can connect to LiveKit securely.

**Acceptance criteria:**
- [ ] `POST /api/rooms/[slug]/token` requires auth session
- [ ] Returns `{ token, wsUrl }` with 4-hour TTL max
- [ ] Token identity = user id; name = display name
- [ ] API keys never exposed to client bundle (server-only env)

### Story 2.3 — LiveKit webhook handler

**As the** system,
**I want** participant join/leave webhooks,
**So that** occupancy stays accurate.

**Acceptance criteria:**
- [ ] `POST /api/webhooks/livekit` validates signature
- [ ] Handles `participant_joined` and `participant_left`
- [ ] Updates `zeo.room_participants` audit rows
- [ ] Maintains in-memory or DB-backed live count per room

---

## Epic 3: Room lifecycle and capacity enforcement

**Goal:** Users create and join rooms; hard limits enforced before media connect.

### Story 3.1 — Create room API and home UI (contributor/admin only)

**As a** contributor or admin,
**I want** to create a named room from the home page,
**So that** I can start a call.

**Acceptance criteria:**
- [ ] `POST /api/rooms` requires session with role `contributor` or `admin`; returns 403 for `user`
- [ ] Creates room with unique slug and livekit_room_name
- [ ] Host set to current user; status `waiting`
- [ ] Home UI: **New room** visible only for contributor/admin
- [ ] Home UI for `user` role: join-only, no create CTA (or disabled with explanation)
- [ ] Redirect to `/room/[slug]` after create

### Story 3.2 — Enforce two concurrent room limit

**As the** system,
**I want** to reject a third room creation,
**So that** VPS capacity is protected.

**Acceptance criteria:**
- [ ] Count rooms with status `waiting` or `active` before create
- [ ] Return 409 with user-visible message when count ≥ 2
- [ ] Home shows "X of 2 rooms in use" when API provides count

### Story 3.3 — Enforce six participant limit on join

**As the** system,
**I want** to reject a seventh participant,
**So that** per-room quality stays acceptable.

**Acceptance criteria:**
- [ ] Token endpoint checks live participant count ≥ 6 → reject with clear error
- [ ] Join page shows "Room is full" state
- [ ] Lobby shows "N of 6 joined" from API

### Story 3.4 — End room and cleanup

**As a** room host,
**I want** to end the room for everyone,
**So that** the call stops and capacity is freed.

**Acceptance criteria:**
- [ ] `POST /api/rooms/[slug]/end` host-only; sets status `ended`, ended_at
- [ ] Disconnects LiveKit room via server API
- [ ] Last participant leaving triggers ended state after 60s grace (configurable)
- [ ] Ended rooms reject new tokens

### Story 3.5 — Host remove participant

**As a** room host,
**I want** to remove a disruptive participant,
**So that** the call can continue.

**Acceptance criteria:**
- [ ] Host can remove via people panel → confirm
- [ ] Server calls LiveKit RemoveParticipant
- [ ] Audit row records `removed_by_id`
- [ ] Removed user sees disconnect message

### Story 3.6 — Guest join without login

**As a** guest without an account,
**I want** to join a room via link with my display name,
**So that** I can participate without signing up.

**Acceptance criteria:**
- [ ] `/room/[slug]` accessible without session; prompts for display name if unauthenticated
- [ ] `POST /api/rooms/[slug]/token` accepts `{ guestName }` without session
- [ ] Issues token with identity `guest_<uuid>` and sanitized display name
- [ ] Rate limit guest token requests per IP (NFR-12)
- [ ] Guest tiles show optional "Guest" badge
- [ ] Guests cannot access create/end/remove APIs

---

## Epic 4: Pre-call lobby and in-call video UI

**Goal:** Complete call experience from device check through group video grid.

### Story 4.1 — Pre-call lobby with device preview

**As a** participant,
**I want** to preview my camera and mic before joining,
**So that** I enter the call prepared.

**Acceptance criteria:**
- [ ] Lobby shows room name, host, participant count
- [ ] Camera preview or avatar placeholder
- [ ] Mic/camera toggles before join
- [ ] Permission-denied help text per UX spec
- [ ] Explicit **Join call** button (no auto-join)

### Story 4.2 — Connect to LiveKit and render participant grid

**As a** participant,
**I want** to see other participants' video,
**So that** we can have a group call.

**Acceptance criteria:**
- [ ] Client connects with minted token on join
- [ ] VideoGrid layouts for 1–6 participants per EXPERIENCE.md
- [ ] Name overlay on each tile
- [ ] Avatar/initials when camera off

### Story 4.3 — Mic, camera, and leave controls

**As a** participant,
**I want** in-call media controls,
**So that** I control my presence.

**Acceptance criteria:**
- [ ] Control bar: mic, camera, leave
- [ ] Keyboard shortcuts M and V
- [ ] aria-label and aria-pressed on toggles
- [ ] Leave disconnects without ending room for others

### Story 4.4 — Active speaker indication

**As a** participant,
**I want** to see who is speaking,
**So that** I can follow the conversation.

**Acceptance criteria:**
- [ ] Primary speaker tile shows accent ring (DESIGN.md)
- [ ] Subscribes to LiveKit active speaker events

### Story 4.5 — Reconnection and error states

**As a** participant,
**I want** clear feedback when connection drops,
**So that** I can rejoin if the room is still active.

**Acceptance criteria:**
- [ ] Reconnecting banner (non-blocking)
- [ ] Fatal disconnect shows rejoin CTA if room active
- [ ] Ended room shows "This room has ended"

---

## Epic 5: Screen sharing

**Goal:** One active screen share with dominant layout.

### Story 5.1 — Start and stop screen share

**As a** participant,
**I want** to share my screen,
**So that** I can present content.

**Acceptance criteria:**
- [ ] Share button in control bar starts `getDisplayMedia` via LiveKit
- [ ] Stop share returns to grid layout
- [ ] Banner: "{Name} is sharing their screen"

### Story 5.2 — Single sharer policy and dominant layout

**As a** participant,
**I want** one screen share at a time with clear layout,
**So that** the call stays readable.

**Acceptance criteria:**
- [ ] New share stops previous sharer's publish (with toast to prior sharer)
- [ ] Shared screen as dominant viewport; participants in filmstrip
- [ ] Screen share button highlighted when self is sharing

---

## Epic 6: Production deployment on Hostinger

**Goal:** Full stack runs on KVM 2 with HTTPS and documented ops.

### Story 6.1 — Caddy reverse proxy configuration

**As an** operator,
**I want** HTTPS routing for zeo and LiveKit,
**So that** browsers allow media capture.

**Acceptance criteria:**
- [ ] Caddyfile template for **zeo.z0xm.com** + **zeo-livekit.z0xm.com**
- [ ] Let's Encrypt automatic certs documented
- [ ] WebSocket upgrade works for LiveKit

### Story 6.2 — TURN configuration and firewall guide

**As an** operator,
**I want** TURN working behind NAT,
**So that** all participants can connect.

**Acceptance criteria:**
- [ ] TURN enabled in LiveKit or coturn sidecar documented
- [ ] Hostinger + ufw port checklist in deploy README
- [ ] Client ICE servers include TURN in token or config

### Story 6.3 — Production env and runbook

**As an** operator,
**I want** a deployment runbook,
**So that** I can install and restart zeo safely.

**Acceptance criteria:**
- [ ] Document env vars for zeo, LiveKit, auth-service, DB
- [ ] systemd or compose commands for start/stop/logs
- [ ] Health check verification steps post-deploy

---

## Epic 7 (Phase 2): Chat, devices, and waiting room

**Goal:** Enhanced collaboration without changing media architecture.

### Story 7.1 — In-room text chat
- [ ] FR-36: messages scoped to room; sanitized; scrollable panel

### Story 7.2 — Device picker
- [ ] FR-38: select mic/camera from enumerated devices in lobby

### Story 7.3 — Connection quality indicator
- [ ] FR-39: quality badge on self tile or status bar

### Story 7.4 — Waiting room
- [ ] FR-37: host admits participants before LiveKit connect

---

## Epic 8 (Phase 3): Admin, scheduling, recording

**Goal:** Operator tools and advanced features.

### Story 8.1 — Admin dashboard
- [ ] FR-41: list active rooms, force-end

### Story 8.2 — Scheduled rooms
- [ ] FR-42: future start time, persistent link

### Story 8.3 — Recording via LiveKit Egress
- [ ] FR-43: start/stop record, storage config

### Story 8.4 — Operator configuration
- [ ] FR-44: adjust global limits and feature flags via admin dashboard

---

## Epic Summary

| Epic | Phase | Stories | Theme |
|------|-------|---------|-------|
| 1 | MVP | 1.1–1.3 | App scaffold + auth + DB |
| 2 | MVP | 2.1–2.3 | LiveKit infra + tokens + webhooks |
| 3 | MVP | 3.1–3.6 | Rooms + capacity + guest join + host controls |
| 4 | MVP | 4.1–4.5 | Lobby + grid + controls |
| 5 | MVP | 5.1–5.2 | Screen share |
| 6 | MVP | 6.1–6.3 | Hostinger deploy |
| 7 | Phase 2 | 7.1–7.4 | Chat, devices, waiting room |
| 8 | Phase 3 | 8.1–8.4 | Admin, schedule, record |

**MVP story count:** 21 implementable stories across Epics 1–6.

## Suggested sprint order

1. Epic 1 (all) — foundation
2. Epic 2.1, 2.2 — LiveKit + tokens (enables spike)
3. Epic 4.1, 4.2 — lobby + connect (vertical slice demo)
4. Epic 3 — room lifecycle + limits
5. Epic 4.3–4.5, Epic 5 — polish + screen share
6. Epic 2.3 — webhook hardening
7. Epic 6 — production deploy
