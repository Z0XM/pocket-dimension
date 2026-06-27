# zeo — Project Context (for AI agents)

**Product:** Self-hosted group video calling (max 2 rooms × 6 participants)  
**Monorepo path:** `apps/zeo` (to be created)  
**Media:** LiveKit Server self-hosted on Hostinger KVM 2  
**Auth:** `@pocket-dimension/auth` + auth-service  

## Key constraints

- Do not exceed **2 concurrent rooms** or **6 participants per room** — enforce before LiveKit token mint.
- Use **SFU (LiveKit)**, never pure P2P mesh for group calls.
- **One active screen share** at a time.
- Cap video at **720p**; prefer **480p** when 5–6 on camera.
- Dev port: **3008**. PostgreSQL schema: **`zeo`**.

## Planning artifacts

All specs live under `_bmad-output/zeo/planning-artifacts/`:

- `product-brief-zeo.md`
- `prds/prd-zeo-2026-06-27/prd.md`
- `architecture.md`
- `epics.md`
- `ux-designs/ux-zeo-2026-06-27/DESIGN.md` + `EXPERIENCE.md`

## Monorepo patterns to follow

- Copy auth route structure from `apps/watchlist` or `apps/chhan-chhan`
- Drizzle schema in `shared/db/src/schema/zeo/`
- Built shared packages required before dev: `bun run build`
- `.env` from `.env.example`; non-empty `RESEND_API_KEY` for auth-service

## Implementation order

Epics 1 → 2 → 4 (slice) → 3 → 4–5 → 6 per `epics.md` suggested sprint order.

## Out of scope for MVP

Guest links, chat, recording, admin dashboard, PSTN, breakout rooms.
