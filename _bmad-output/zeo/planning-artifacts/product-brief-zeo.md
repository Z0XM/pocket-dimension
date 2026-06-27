# Product Brief: zeo

## Executive Summary

**zeo** is a self-hosted group video calling application within the Pocket Dimension monorepo. It enables small teams and trusted groups to start video meetings with screen sharing over the internet, running on the owner's Hostinger KVM 2 VPS with open-source media infrastructure (LiveKit).

The product targets **low-volume, controlled usage**: at most **2 concurrent rooms**, each with up to **6 participants**. It is not a public Zoom competitor — it is a private, auth-gated conferencing tool for people who already belong to the Pocket Dimension ecosystem (or invited guests).

## The Problem

Existing video tools (Zoom, Google Meet, Discord) work well but introduce vendor dependency, privacy tradeoffs, and recurring cost. For a small, predictable user base with modest concurrency needs, a self-hosted solution on existing infrastructure can provide sufficient quality with full control over data flow and access policy.

Building video calling from scratch with raw WebRTC is feasible for 1:1 calls but breaks down for 6-person group calls without a media server (SFU). The challenge is choosing the right open-source stack and sizing it correctly for a single VPS.

## The Solution

zeo combines:

- A **SvelteKit web app** (`apps/zeo`) integrated with shared Better Auth
- **LiveKit Server** (Apache 2.0 SFU) for group video and screen sharing
- **TURN** (LiveKit embedded or coturn) for NAT/firewall traversal
- **Caddy/nginx** for HTTPS termination on Hostinger

Users authenticate, create or join a room, and enter a call with standard controls: camera, mic, screen share, participant list, and leave. The backend enforces hard caps on concurrent rooms and participants before issuing LiveKit join tokens.

## Who This Serves

### Primary users
- Authenticated Pocket Dimension users who need occasional group calls (friends, small teams, collaborators).

### Secondary users
- **Guests** invited via room link (optional phase — may require logged-in host to create room first).

### Operator
- The VPS owner who deploys LiveKit, monitors usage, and manages capacity limits.

## What Makes This Different

- **Self-hosted on existing Hostinger VPS** — no per-minute vendor fees at this scale.
- **Hard capacity guardrails** — 2 rooms × 6 people, enforced in application logic, matched to hardware.
- **Monorepo-native** — reuses shared auth, DB conventions, and SvelteKit patterns from sibling apps.
- **Open-source media stack** — LiveKit SFU, not proprietary SDK lock-in for the media layer.

## Success Criteria

- Two rooms can run simultaneously with 6 participants each, including at least one active screen share, without sustained CPU throttling on KVM 2.
- Users behind typical home/office NAT can connect reliably (TURN fallback works).
- Room creation and join flows complete in under 30 seconds for a first-time user with granted permissions.
- Unauthorized users cannot join rooms or exceed capacity limits.
- The app deploys alongside other Pocket Dimension services with documented Docker compose for LiveKit.

## Scope

### In scope (MVP foundation)
- Authenticated room create/join
- Group video (up to 6 per room)
- Audio mute/unmute, camera on/off
- Screen sharing (one active sharer at a time)
- Participant grid with active speaker indication
- Hard limits: 2 concurrent rooms, 6 participants per room
- Self-hosted LiveKit on Hostinger KVM 2
- Pre-call device check (mic/camera permission)
- Leave/end room behavior with cleanup
- Basic host controls (remove participant, end room for all)

### In scope (post-MVP phases)
- Text chat in room
- Waiting room / admit guest
- Device selector (choose mic/camera)
- Connection quality indicator
- Admin usage dashboard
- Scheduled rooms with calendar links
- Recording via LiveKit Egress (optional, bandwidth-heavy)

### Explicitly deferred
- Phone/PSTN dial-in
- Breakout rooms
- Whiteboard / collaborative docs
- Multi-region SFU clustering
- Native mobile apps (web responsive only initially)
- End-to-end encryption (LiveKit supports it; defer until compliance need is clear)

## Vision

zeo becomes the default "start a call" surface inside Pocket Dimension — lightweight, private, and sized honestly for the hardware it runs on. It starts as a focused 6-person room tool and can grow (recording, scheduling, guest links) without re-architecting the media layer.

## Open Questions

- Should all users be able to create rooms, or only a designated role?
- Are guest join links (no account) required for MVP, or auth-only?
- Preferred production domain/subdomain for zeo and LiveKit (e.g. `zeo.example.com`, `livekit.example.com`)?
