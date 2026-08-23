# Integration Architecture

## Overview

```
Browser
  ├─ SvelteKit apps (3002–3008)
  │    ├─ hooks.server.ts → @pocket-dimension/auth (session cookies)
  │    ├─ createAuthClient → PUBLIC_BASE_AUTH_URL (auth-service :5001)
  │    └─ server loaders/actions → @pocket-dimension/db → PostgreSQL 18
  ├─ rhymes / markitdown / pocket — no auth-service, no shared DB
  └─ zeo browser also ↔ wss LiveKit SFU

auth-service (:5001)
  └─ @pocket-dimension/auth → Better Auth → @pocket-dimension/db → auth.*

zeo (:3008)
  ├─ LiveKit RoomService + webhooks
  └─ MUSIC_WORKER_URL (:3010)  ↔  zeo-music-worker (yt-dlp / ffmpeg / rtc-node)
```

## Integration points

| From | To | Type | Details |
| --- | --- | --- | --- |
| Any auth app (browser) | auth-service | REST + cookies | Sign-up/in, session, password reset, verification. `PUBLIC_BASE_AUTH_URL` + `PUBLIC_BASE_AUTH_PATH` |
| Any auth app (SSR) | shared-auth | In-process | `auth.api.getSession` + `svelteKitHandler` in `hooks.server.ts` |
| Any DB app | shared-db | In-process | Drizzle `db` + `schema` |
| shared-auth | shared-db | In-process | `drizzleAdapter(db, { provider: "pg" })` |
| shared-auth / auth-service | Resend | HTTPS | Verification, reset, magic-link emails (fire-and-forget) |
| All DB tables | auth.user | FK | Cascade delete on user removal |
| zeo | LiveKit | JWT + RoomService + webhooks | Token mint, occupancy, screen-share mute, room finished |
| zeo | zeo-music-worker | REST + shared secret | `MUSIC_WORKER_SECRET`; bot token, play/pause/seek, worker events |
| zeo-music-worker | zeo | REST + Bearer | `/api/internal/listening/*` |
| zeo | Google / YouTube | OAuth + Data API | Shared listening linker account |
| pocket | sibling apps | Links only | Env URLs; no API proxy |
| markitdown | Python markitdown | `Bun.spawn` | `python/convert.py`; ffmpeg + exiftool |
| howwasyourday | Web Push | VAPID | `node-cron` scheduler in hooks |

## Auth cookie contract

Better Auth cookies: prefix `better-auth`, `secure: true`, `httpOnly: true`, `sameSite: "none"`, optional `BETTER_AUTH_COOKIE_DOMAIN` for subdomains.

`BETTER_AUTH_SECRET` **must be identical** on auth-service and every frontend that imports `@pocket-dimension/auth`. `BETTER_AUTH_TRUSTED_ORIGINS` must list every frontend origin.

Local caveat: browsers often **will not persist** these cookies on plain `http://localhost`. Signup can work; a logged-in session may not stick.

## Shared package build contract

Apps import **built** `dist/` of `@pocket-dimension/{auth,db,utils}`. Order: utils → db → auth. `auth-service` itself has no compile step (Bun runs TS).

## Capacity / policy (zeo)

| Rule | Where enforced |
| --- | --- |
| Max 2 concurrent rooms (operator-configurable) | `apps/zeo/src/lib/server/rooms.ts` |
| Max 6 humans / room (bots excluded) | `room-occupancy.ts` + LiveKit API |
| One screen share | Client + `POST …/screen-share/stop-active` |
| Join requires login | `room/[slug]/+page.server.ts` + token API `requireUser` |
| Create room: contributor or admin | `apps/zeo/src/lib/server/authz.ts` |

## Port map

| Service | Port | Conflict |
| --- | --- | --- |
| auth-service | 5001 | — |
| watchlist | 3002 | — |
| rhymes | 3003 | — |
| howwasyourday | 3004 | — |
| chhan-chhan | 3005 | — |
| me-via-you | 3006 | — |
| markitdown | 3009 | — |
| pocket | 3007 | — |
| zeo | 3008 | — |
| zeo-music-worker | 3010 | Internal; no public domain in prod |

## Data flow examples

**Sign in:** browser → auth-service `POST /sign-in/email` → Set-Cookie → later SSR `getSession` on the app.

**Watchlist row:** `+page.server.ts` / `GET /api/watchlist` → Drizzle/Kysely against `watchlist.*`.

**zeo join:** login → `POST /api/rooms/:slug/token` → LiveKit JWT → `livekit-client.connect(PUBLIC_LIVEKIT_URL)`.

**Shared listening:** zeo starts session → worker `POST /jobs/play` → worker mints bot token from zeo → publishes audio track on LiveKit.
