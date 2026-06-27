---
title: zeo PRD
status: final
created: 2026-06-27
updated: 2026-06-27
sources:
  - /workspace/_bmad-output/zeo/planning-artifacts/product-brief-zeo.md
  - conversation: feasibility and architecture decisions 2026-06-27
---

# zeo PRD

## Executive Summary

**zeo** is a self-hosted group video calling product in the Pocket Dimension monorepo. Authenticated users create or join video rooms with up to six participants, share their screen, and manage in-call media controls. Media is routed through a self-hosted **LiveKit SFU** on the owner's Hostinger KVM 2 VPS.

The product is intentionally capacity-limited: **two concurrent rooms** and **six participants per room**. These limits are enforced in the application layer before LiveKit tokens are issued, aligning software guardrails with hardware constraints (2 vCPU, 8 GB RAM).

## Problem Statement

Small groups need reliable video calls with screen sharing without committing to commercial per-seat or per-minute pricing. Pure peer-to-peer WebRTC fails for six-person groups and strict corporate networks. A managed SFU platform solves reliability but adds cost and vendor dependency. zeo targets the middle path: **open-source SFU, self-hosted, monorepo-integrated, honestly sized for low usage**.

## Product Goals

### G1. Reliable small-group calls
Six participants in one room can see and hear each other with acceptable quality on typical home broadband, including when direct peer connections fail (TURN relay).

### G2. Screen sharing that works
Any participant (when not blocked by host policy) can share their screen; only one screen share is active at a time to protect VPS resources.

### G3. Enforced capacity limits
The system never admits a third concurrent room or a seventh participant to an existing room.

### G4. Monorepo consistency
zeo reuses shared auth, database conventions, and SvelteKit patterns so it feels native to Pocket Dimension.

### G5. Operable on a single VPS
Deployment documentation and defaults must allow the full stack (app + LiveKit + reverse proxy) to run on Hostinger KVM 2.

## Users and Roles

### Authenticated member
- Signs in via shared Better Auth.
- Can create a room (MVP) and join rooms they are invited to.
- Controls own mic, camera, and screen share.
- Can leave a call at any time.

### Room host
- The user who created the room (MVP: creator = host).
- Can end the room for all participants.
- Can remove a participant from the room (MVP).
- Phase 2: admit guests from waiting room, mute others.

### Operator / admin (Phase 3)
- Views active rooms and system health.
- Can force-close rooms.
- Configures global limits and feature flags.

## User Journeys

### UJ-1 — Priya starts a team sync
Priya logs into zeo, clicks **New room**, enters "Design sync", and lands in a pre-call lobby. She allows camera and mic, confirms her devices work, then clicks **Join**. She copies the room link and sends it to five teammates. As each joins, their tile appears in the grid. Priya shares her Figma tab; others see her screen as the dominant tile. When done, she clicks **End room for all** and everyone disconnects. The room is marked closed in the database.

### UJ-2 — Marco joins an existing call
Marco receives Priya's link, logs in, and opens the join page. The system shows room name, participant count (4/6), and a **Join** button. Marco completes the device check, joins, and is muted by default [ASSUMPTION: join muted optional — default unmuted per FR]. He toggles mute when his dog barks. He leaves without ending the room for others.

### UJ-3 — System at capacity
A third user tries to create a room while two are active. The API returns a clear error: "All rooms are in use. Try again later." No LiveKit token is issued.

## Release Phases

| Phase | Focus |
|-------|--------|
| **MVP (Phase 1)** | Auth, create/join, 6-person video, screen share, host end/remove, capacity limits, LiveKit deploy |
| **Phase 2** | Text chat, waiting room, device picker, connection quality, guest links |
| **Phase 3** | Admin dashboard, scheduled rooms, recording (Egress), role-based room creation |

---

## Functional Requirements

### Authentication and access

#### FR-1 Authenticated access
The product shall require a valid Better Auth session to create a room or join a room (MVP).

#### FR-2 Session integration
The product shall use the monorepo shared auth package and auth-service with identical `BETTER_AUTH_SECRET` and `PUBLIC_BASE_AUTH_URL` configuration.

#### FR-3 Sign-in and sign-up flows
The product shall provide login, sign-up, forgot-password, and email-verification routes consistent with sibling SvelteKit apps.

### Room lifecycle

#### FR-4 Create room
An authenticated user shall be able to create a new room with a display name; the system assigns a unique room slug or code.

#### FR-5 Join room by link
An authenticated user shall be able to join an active room via URL containing the room identifier.

#### FR-6 Room states
The system shall track room states: `waiting` (created, no media yet), `active` (at least one participant connected to LiveKit), `ended` (closed).

#### FR-7 End room
The room host shall be able to end the room for all participants; the system invalidates further join tokens and marks the room `ended`.

#### FR-8 Leave room
Any participant shall be able to leave without ending the room for others.

#### FR-9 Room cleanup
When the last participant leaves, the system shall transition the room to `ended` and release the concurrent-room slot within a configurable grace period (default 60 seconds).

#### FR-10 Room metadata
The system shall persist room id, slug, display name, host user id, created at, ended at, and max participant count.

### Capacity enforcement

#### FR-11 Concurrent room limit
The system shall allow at most **2** rooms in `waiting` or `active` state simultaneously across the deployment.

#### FR-12 Per-room participant limit
The system shall allow at most **6** participants connected to a single room simultaneously.

#### FR-13 Pre-token validation
The system shall validate room and participant limits **before** issuing a LiveKit access token; exceeded limits return a user-visible error without partial admission.

#### FR-14 Participant counting
Participant count shall reflect users currently connected to LiveKit, reconciled via webhooks or periodic sync (not only DB intent).

### LiveKit integration

#### FR-15 Token issuance
The server shall mint short-lived LiveKit JWT tokens scoped to a specific room name and participant identity.

#### FR-16 Participant identity
Each token shall bind a stable participant identity (authenticated user id) and display name.

#### FR-17 Room name mapping
Each zeo room shall map to exactly one LiveKit room name; names must be unique and non-guessable (UUID-based).

#### FR-18 Token expiry
Join tokens shall expire within 4 hours of issuance or when the room ends, whichever is sooner.

#### FR-19 LiveKit webhooks
The system shall consume LiveKit webhooks for participant join/leave events to keep occupancy accurate.

### In-call media — video and audio

#### FR-20 Publish camera
A participant shall be able to enable and disable their camera during a call.

#### FR-21 Publish microphone
A participant shall be able to mute and unmute their microphone during a call.

#### FR-22 Subscribe to others
Each participant shall receive audio and video tracks from other participants in the same room (up to capacity).

#### FR-23 Participant grid
The in-call UI shall display a grid (or dominant layout) of participant video tiles with display names.

#### FR-24 Active speaker indication
The UI shall highlight the tile of the current active speaker when detectable via LiveKit speaker events.

#### FR-25 No video fallback
When a participant disables video, the UI shall show an avatar or initials placeholder with name label.

#### FR-26 Adaptive quality
The client shall use LiveKit simulcast defaults; server config shall cap inbound publish at 720p (MVP).

### Screen sharing

#### FR-27 Start screen share
A participant shall be able to share their screen (browser `getDisplayMedia` via LiveKit).

#### FR-28 Stop screen share
The sharer shall be able to stop screen sharing; others return to the normal grid layout.

#### FR-29 Single active screen share
When a participant starts screen share while another is active, the system shall either stop the prior share or reject the new share with a clear message (MVP: stop prior share with notification to previous sharer).

#### FR-30 Screen share layout
While screen share is active, the UI shall show the shared screen as the dominant view with participant tiles secondary.

### Pre-call and device experience

#### FR-31 Pre-call lobby
Before joining LiveKit, the user shall see a lobby with camera/mic preview and permission prompts.

#### FR-32 Permission handling
The UI shall guide users when browser permissions are denied, with steps to re-enable camera/mic.

#### FR-33 Join action
The user shall explicitly confirm **Join call** from the lobby (no auto-join on page load).

### Host controls (MVP)

#### FR-34 Remove participant
The host shall be able to remove a participant from the room; removed users are disconnected and cannot rejoin without a new token if room still active.

#### FR-35 Host transfer
Deferred to Phase 2: automatic host transfer when host leaves.

### Phase 2 — Enhanced collaboration

#### FR-36 In-room text chat
Participants shall send and receive text messages scoped to the room.

#### FR-37 Waiting room
Host can require admission before guests enter the LiveKit room.

#### FR-38 Device selection
User can choose camera and microphone from available devices before and during a call.

#### FR-39 Connection quality
UI shows per-participant or self connection quality (excellent / good / poor).

#### FR-40 Guest join links
Host can generate a time-limited guest link that allows join without a full account [ASSUMPTION: guest identity is display-name only].

### Phase 3 — Administration and scheduling

#### FR-41 Admin dashboard
Operator can list active rooms, participant counts, and force-end a room.

#### FR-42 Scheduled rooms
User can schedule a room for a future time with a persistent link.

#### FR-43 Recording
Authorized host can start/stop room recording via LiveKit Egress; recordings stored per operator-configured storage.

#### FR-44 Role-based room creation
Configuration can restrict room creation to users with a specific role or allowlist.

---

## Non-Functional Requirements

#### NFR-1 HTTPS required
All production traffic shall use HTTPS; camera, mic, and screen capture require secure context.

#### NFR-2 Browser support
MVP shall support latest Chrome, Firefox, Edge, and Safari (desktop); mobile Safari best-effort.

#### NFR-3 Latency target
Median mouth-to-ear latency under 300 ms for participants in the same geographic region as the VPS [ASSUMPTION: VPS and users primarily same region].

#### NFR-4 Availability
Single-node deployment; no HA requirement for MVP. Target 99% uptime excluding planned maintenance.

#### NFR-5 Resource envelope
Deployment defaults shall target Hostinger KVM 2: 2 vCPU, 8 GB RAM, 8 TB/month bandwidth.

#### NFR-6 Data residency
All media flows through the self-hosted LiveKit instance on the user's VPS; no third-party SFU in MVP.

#### NFR-7 Security
LiveKit API keys and TURN credentials shall not be exposed to clients except short-lived tokens/credentials.

#### NFR-8 Auditability
Room create, end, host remove, and admin force-end actions shall be attributable to authenticated user ids.

#### NFR-9 Accessibility floor
In-call controls shall be keyboard-operable; tiles shall expose participant names to assistive tech; mute state shall be programmatically determinable.

#### NFR-10 Observability
Structured logs for token issuance, capacity rejections, webhook events, and room state transitions.

---

## Success Metrics

| Metric | Target (MVP) |
|--------|----------------|
| Call connect success rate | ≥ 95% of join attempts reach connected state |
| TURN fallback success | ≥ 90% of TURN-required clients connect |
| Capacity enforcement | 0 instances of >2 rooms or >6 participants |
| P95 time to join (after auth) | < 15 seconds |
| CPU throttle incidents | No sustained throttling during 60-min 6-person call with screen share |

### Counter-metrics
- Do not optimize for concurrent rooms beyond 2 (avoid scope creep).
- Do not prioritize sub-100 ms latency at cost of reliability on single VPS.

---

## Out of Scope (MVP)

- PSTN / phone dial-in
- Breakout rooms
- Whiteboard, polls, reactions
- Native iOS/Android apps
- Multi-region SFU
- End-to-end encryption
- AI transcription / summaries

---

## Dependencies and Assumptions

- Hostinger KVM 2 with root access, public IPv4, and ability to open UDP ports for WebRTC/TURN.
- PostgreSQL 18 available (monorepo standard).
- auth-service running for session validation.
- Domain with DNS pointing to VPS for TLS certificates.
- `[ASSUMPTION]` Users primarily connect from desktop/laptop browsers.
- `[ASSUMPTION]` MVP join default: microphone unmuted, camera on if permission granted (configurable).

---

## Open Questions

1. Production domain/subdomain naming for zeo app vs LiveKit endpoint?
2. Should removed participants be blocked from rejoining the same room session?
3. Is recording a near-term requirement or firmly Phase 3?
