# zeo — Project Context (for AI agents)

**Product:** Self-hosted group video calling (max 2 rooms × 6 participants)  
**Monorepo path:** `apps/zeo`  
**Media:** LiveKit Server self-hosted on Hostinger KVM 2  
**Auth:** `@pocket-dimension/auth` + auth-service  

## Branding (2026-06-27)

- **Icon:** multi-tile video grid SVG (`apps/zeo/static/icon.svg`)
- **Theme:** dark UI; **off-white `#f5f5f0` primary** for actions/text
- **Participant tiles:** distinct colors per user (`src/lib/participant-colors.ts`) — green, purple, yellow, red, blue, orange

## Production URLs

- App: **https://zeo.z0xm.com**
- LiveKit: **wss://zeo-livekit.z0xm.com**

## Key constraints

- Do not exceed **2 concurrent rooms** or **6 participants per room** — enforce before LiveKit token mint.
- Use **SFU (LiveKit)**, never pure P2P mesh for group calls.
- **One active screen share** at a time.
- Cap video at **720p**; prefer **480p** when 5–6 on camera.
- Dev port: **3008**. PostgreSQL schema: **`zeo`**.

## Access rules

| Action | Who |
|--------|-----|
| Create room | `contributor` or `admin` only (`auth.users.role`) |
| Join authenticated | Any logged-in user (required for all zeo joins) |
| Host remove | Blocks rejoin for that room session until room ends |

## Features in / out of scope

| In MVP | Out of scope |
|--------|----------------|
| Group video, screen share | Video/audio **recording** |
| **Call snapshot** (PNG download) | LiveKit Egress |
| Session block after remove | |

## Planning artifacts

All specs live under `_bmad-output/zeo/planning-artifacts/`.

Phase 4 (Game Mode): see `prd-zeo-game-mode-2026-07-12/`, `ux-zeo-game-mode-2026-07-12/`, `architecture-game-mode.md`, `epics-game-mode.md`.

Stream media controls (tile share toggles, per-tile volume, A/V quality, tile stats, nonlinear level meter): `specs/spec-stream-media-controls/` (Epic 16 stories in `stories.md`).

## Implementation order

Epics 1 → 2 → 4 (slice) → 3 → 4–5 → 6 per `epics.md`.
