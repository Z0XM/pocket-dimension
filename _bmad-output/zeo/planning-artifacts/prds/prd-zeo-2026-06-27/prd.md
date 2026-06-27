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

**zeo** is a self-hosted group video calling product in the Pocket Dimension monorepo. **Contributors and admins** create video rooms; **guests and authenticated users** join via link — no login required for guests. Up to six participants per room share video and screen; media routes through a self-hosted **LiveKit SFU** on Hostinger KVM 2.

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

### Contributor or admin (room creator / host)
- Global Pocket Dimension role: `contributor` or `admin` on `auth.users.role`.
- Can create rooms and is host of rooms they create.
- Controls own mic, camera, and screen share.
- Can end the room for all and remove participants (MVP).

### Authenticated member (`user` role)
- Can sign in and join existing rooms via link.
- Cannot create new rooms.
- Full in-call media controls for self.

### Guest (unauthenticated)
- Joins via room link without an account.
- Enters a display name before joining.
- Receives a scoped guest token; LiveKit identity `guest_<uuid>`.
- Cannot create rooms.
- Phase 2: optional waiting room admission by host.

### Operator / admin (Phase 3)
- Views active rooms and system health.
- Can force-close rooms.
- Configures global limits and feature flags.

## User Journeys

### UJ-1 — Priya starts a team sync
Priya (contributor) logs into zeo, clicks **New room**, enters "Design sync", and lands in a pre-call lobby. She allows camera and mic, confirms her devices work, then clicks **Join**. She copies the room link and sends it to five teammates. As each joins, their tile appears in the grid. Priya shares her Figma tab; others see her screen as the dominant tile. When done, she clicks **End room for all** and everyone disconnects. The room is marked closed in the database.

### UJ-2 — Marco joins as a guest
Marco receives Priya's link and opens it without logging in. He enters his name "Marco", allows mic when prompted, and clicks **Join**. He appears in the grid as a guest. He cannot create a room if he later visits the home page without signing in as contributor/admin.

### UJ-3 — Regular user cannot create a room
Sam is logged in with role `user`. The home page shows join options but no **New room** button (or shows it disabled with explanation). An API attempt to create a room returns 403.

### UJ-4 — System at capacity
A third user tries to create a room while two are active. The API returns a clear error: "All rooms are in use. Try again later." No LiveKit token is issued.

## Release Phases

| Phase | Focus |
|-------|--------|
| Phase | Focus |
|-------|--------|
| **MVP (Phase 1)** | Role-gated create, guest + auth join, session block on remove, 6-person video, screen share, **call snapshot**, host controls, capacity limits, LiveKit deploy |
| **Phase 2** | Text chat, waiting room, device picker, connection quality |
| **Phase 3** | Admin dashboard, scheduled rooms |

---

## Functional Requirements

### Authentication and access

#### FR-1 Access model
The product shall allow **guest join without login** via room link (display name required) and **authenticated join** for users with a Better Auth session.

#### FR-2 Session integration
The product shall use the monorepo shared auth package and auth-service with identical `BETTER_AUTH_SECRET` and `PUBLIC_BASE_AUTH_URL` configuration for authenticated flows.

#### FR-3 Sign-in and sign-up flows
The product shall provide login, sign-up, forgot-password, and email-verification routes for users who choose to authenticate (optional for joining a call).

#### FR-3a Room creation role gate
Only users whose global role is **`contributor` or `admin`** shall be able to create rooms. Users with role **`user`** shall receive 403 on create attempts.

### Room lifecycle

#### FR-4 Create room
A user with role **contributor or admin** shall be able to create a new room with a display name; the system assigns a unique room slug or code.

#### FR-5 Join room by link
Any person with a valid room link shall be able to join an active room — either as an authenticated user or as a guest with a display name (no account).

#### FR-5a Guest display name
Guests shall provide a display name (1–50 chars, trimmed) before joining; profanity filter optional Phase 2.

#### FR-5b Guest identity
Guest participants shall use LiveKit identity `guest_<uuid>`; display name shown in UI only.

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
The server shall mint short-lived LiveKit JWT tokens scoped to a specific room name and participant identity — for authenticated users (user id) or guests (guest uuid).

#### FR-16 Participant identity
Each token shall bind a stable participant identity (authenticated `user.id` or `guest_<uuid>`) and display name.

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
The host shall be able to remove a participant from the room; removed users are disconnected and **blocked from rejoining that room session** (until the room ends). Block applies to both guests and authenticated users.

#### FR-34a Session block enforcement
The token endpoint shall reject mint requests from identities on the room's session block list with a clear "You were removed from this call" message.

#### FR-35 Host transfer
Deferred to Phase 2: automatic host transfer when host leaves.

### Guest join (MVP)

#### FR-40 Guest join without account
Room links shall allow unauthenticated join: guest enters display name, passes device check, receives guest token, and enters the LiveKit room without creating an account — unless blocked for this session (FR-34a).

### Call snapshot (MVP)

#### FR-43 Call snapshot
Any participant in an active call shall be able to capture a **snapshot** of the current call view (visible participant tiles and active screen share, if any) as a PNG image.

#### FR-43a Snapshot delivery
The snapshot shall download to the participant's device immediately (browser download). Server persistence is optional Phase 2.

#### FR-43b Snapshot scope
The snapshot reflects the capturing user's current on-screen call layout at the moment of capture; it is not a server-side composite of off-screen participants.

### Phase 2 — Enhanced collaboration

#### FR-36 In-room text chat
Participants shall send and receive text messages scoped to the room.

#### FR-37 Waiting room
Host can require admission before guests enter the LiveKit room.

#### FR-38 Device selection
User can choose camera and microphone from available devices before and during a call.

#### FR-39 Connection quality
UI shows per-participant or self connection quality (excellent / good / poor).

### Phase 3 — Administration and scheduling

#### FR-41 Admin dashboard
Operator can list active rooms, participant counts, and force-end a room.

#### FR-42 Scheduled rooms
User can schedule a room for a future time with a persistent link.

#### FR-44 Operator configuration
Operator can adjust global limits and feature flags via admin dashboard (Phase 3).

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

#### NFR-11 Production domains
Production shall serve the app at **https://zeo.z0xm.com** and LiveKit WSS at **https://zeo-livekit.z0xm.com**.

#### NFR-12 Guest abuse mitigation
Guest token endpoint shall be rate-limited per IP (e.g. 20/hour) and require valid room slug; display names sanitized.

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
- Video/audio **recording** (LiveKit Egress or any continuous capture)

---

## Dependencies and Assumptions

- Hostinger KVM 2 with root access, public IPv4, and ability to open UDP ports for WebRTC/TURN.
- PostgreSQL 18 available (monorepo standard).
- auth-service running for session validation.
- Domain with DNS: **zeo.z0xm.com**, **zeo-livekit.z0xm.com**
- `[ASSUMPTION]` Users primarily connect from desktop/laptop browsers.
- `[ASSUMPTION]` MVP join default: microphone unmuted, camera on if permission granted (configurable).

---

## Resolved decisions (2026-06-27)

1. **Room creation:** contributor or admin role only (global `auth.users.role`).
2. **Guest join:** allowed in MVP without login; display name required.
3. **Production URLs:** zeo.z0xm.com (app), zeo-livekit.z0xm.com (LiveKit).
4. **Removed participants:** blocked from rejoining until room ends.
5. **Recording:** out of scope; **call snapshot** (PNG) in MVP instead.

## Open Questions

None blocking MVP.
