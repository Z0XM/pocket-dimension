# zeo Shared Listening PRD — Addendum

Technical context supporting `prd.md`. Product requirements live in the PRD; this file holds mechanism and brownfield notes.

## Relationship

- Extends Game Mode PRD shell (`prd-zeo-game-mode-2026-07-12`) by renaming Game mode → **Games and Apps** and adding Apps.
- Decisions source: `shared-listening-decisions.md` (locked 2026-07-25).
- Implementation contract: `specs/spec-shared-listening/` (SPEC + companions).

## Stack decisions

| Layer | Choice | Notes |
|-------|--------|-------|
| Panel | Evolve `GamePanel.svelte` | Tabs Apps \| Games \| Scoreboard |
| Listening state | Postgres + SSE + HTTP | Mirror game-mode pattern; separate endpoints under `/listening` |
| Resolve | yt-dlp (+ InnerTube for YTM library) | Uses linker OAuth/cookie jar |
| Decode | ffmpeg → PCM s16le ~48 kHz | |
| Publish | `@livekit/rtc-node` listening bot | WHIP fallback only if spike fails |
| Worker | Bun/Node `music-worker` | Max 2 concurrent playback jobs |
| OAuth | Google OAuth in `apps/zeo` | Encrypted refresh tokens per user |

## Schema sketch

```
youtube_account_links
  user_id PK
  google_sub
  refresh_token_enc
  access_token_enc nullable
  access_expires_at
  scopes text
  linked_at, revoked_at

listening_sessions
  id
  room_id (unique among active)
  linker_user_id
  dj_user_id
  playback_state  -- idle|playing|paused|error
  current_queue_item_id nullable
  position_ms
  error_message nullable
  bot_identity
  created_at, ended_at

listening_queue_items
  id, session_id, position
  video_id, title, channel_title, thumbnail_url, duration_ms nullable
  source  -- library_yt|library_ytm|search|url
  added_by_user_id
  created_at
```

## API sketch

- `GET/DELETE /api/me/youtube-link`
- OAuth start + callback routes
- `POST/DELETE /api/rooms/[slug]/listening`
- `GET /api/rooms/[slug]/listening/events` (SSE)
- `GET …/listening/library/playlists` · `…/playlists/[id]/items`
- `GET …/listening/library/music/…`
- `GET …/listening/search?q=`
- `POST/PATCH …/listening/queue`
- `POST …/listening/play|pause|seek|skip|previous`
- `POST …/listening/dj`

## Client touchpoints

| Concern | Files (expected) |
|---------|------------------|
| Shell rename + tabs | `ControlBar.svelte`, `GamePanel.svelte` → possibly `GamesAndAppsPanel.svelte`, `CallExperience.svelte` |
| Stage tile | `stage-tiles.ts`, `VideoGrid.svelte`, new `ListeningTile.svelte` |
| Bot filter | Participant list / tile builder — hide `listening-bot:*` from camera tiles |
| Volume | Existing tile volume helpers; key e.g. `listening:{roomOrSession}` |
| Listening SSE | New `listening-state.ts` store (parallel to `game-state.ts`) |

## Risk register (ops)

| Risk | Mitigation |
|------|------------|
| YouTube ToS / extractor break | Feature-flag App; update yt-dlp; maintenance copy on Apps card |
| Account friction | Clear reconnect UX; don’t share one Google login across many operators unnecessarily |
| KVM 2 CPU | Cap 2 bots; monitor; tear down aggressively on end |
| Token theft | Encrypt at rest; audit link/unlink |

## Spike exit criteria (Phase 0)

1. Linker-equivalent credentials available to worker.
2. One `videoId` resolves via yt-dlp.
3. Audio audible in a LiveKit room from `listening-bot:*` via `@livekit/rtc-node`.
4. Pause and stop tear down cleanly.

If (3) fails, document WHIP trial before redesigning product FRs.
