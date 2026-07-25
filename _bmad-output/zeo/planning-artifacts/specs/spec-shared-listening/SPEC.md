---
id: SPEC-shared-listening
companions:
  - brownfield.md
  - stack.md
  - ux.md
  - stories.md
sources:
  - /workspace/_bmad-output/zeo/planning-artifacts/shared-listening-decisions.md
  - /workspace/_bmad-output/zeo/planning-artifacts/prds/prd-zeo-shared-listening-2026-07-25/prd.md
  - /workspace/_bmad-output/zeo/planning-artifacts/prds/prd-zeo-shared-listening-2026-07-25/addendum.md
  - /workspace/_bmad-output/zeo/project-context.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Games and Apps shell + Shared Listening

## Why

**Pain to solve / vision to realize.** In-call friends want a shared music queue with one synced stream, not screen-share of YouTube Music. Zeo’s Game mode panel is games-only and has no home for non-game room activities. This work (1) expands that panel into **Games and Apps**, and (2) ships **Shared Listening** as the first App: one linked Google account, server-side stream resolve, LiveKit bot audio, zeo-owned queue and controls.

## Capabilities

- id: CAP-1
  intent: User can open an in-call **Games and Apps** panel with tabs **Apps**, **Games**, and **Scoreboard**, replacing Game mode.
  success: Control bar label is Games and Apps for all authenticated participants; panel shows three tabs; Charades flows live under Games; Scoreboard still lists room game scores; opening the panel alone does not change stage layout.

- id: CAP-2
  intent: User can see **Shared Listening** in the Apps catalog and start or end a room listening session from there (no separate control-bar Listen button).
  success: Apps tab shows Shared Listening with idle / needs-link / active states; Start creates one session per room; End (or host force-end) tears down bot, queue, and listening tile; entry is only via Apps.

- id: CAP-3
  intent: User can link Google / YouTube once so their account can power library browse and stream resolve for a listening session they start.
  success: OAuth connect/disconnect works; tokens never appear in the browser; unlink deletes tokens and ends sessions where that user is linker; session stores sticky `linker_user_id`.

- id: CAP-4
  intent: Participants can browse the linker’s YouTube playlists and Liked items and the linker’s YouTube Music library, and can search or paste YouTube/Music URLs to enqueue tracks.
  success: Playlist/Liked browse works via linker OAuth; Music library/search is available and degrades independently if InnerTube fails; URL paste resolves `videoId`; search results show source badges; any participant may enqueue up to 50 items.

- id: CAP-5
  intent: DJ can control playback (play, pause, seek, skip, previous, reorder/remove) while the room hears one shared LiveKit audio stream from a listening bot; failed tracks auto-skip.
  success: Bot identity is hidden from the camera grid; listening tile shows art/title/scrubber/transport; all participants hear the same bot track; natural end advances queue; resolve/play failure shows error then auto-skips after ~3s; DJ handoff changes controls only, not linker credentials.

- id: CAP-6
  intent: Late joiners and reconnecting clients receive current listening state and audio without a separate catch-up download.
  success: SSE snapshot includes now-playing, queue, DJ/linker ids, playback state, and position; LiveKit subscription to the bot track provides audio immediately when present.

## Constraints

- Brownfield in `apps/zeo` (+ new music-worker package/process); follow existing LiveKit, SSE, and panel mutual-exclusion patterns.
- Hard caps: ≤2 rooms, ≤6 participants, ≤1 listening session and ≤1 listening bot per room.
- Playback path is Discord-bot style extract → music-worker → LiveKit RTC bot (`@livekit/rtc-node`); WHIP only if Phase 0 spike fails.
- Worker runtime: Bun/Node orchestrating `yt-dlp` + `ffmpeg`.
- Listening does not force `stageLayoutMode = "game"`; games still do.
- Listening must not write Scoreboard / `roomScores`.
- Google tokens encrypted at rest; bot LiveKit tokens minted server-side only.
- MVP audio-only (no YouTube video relay).
- Product copy must not claim official YouTube partnership.
- MVP allows Shared Listening and an active game concurrently unless a documented mutex becomes necessary.

## Non-goals

- Official IFrame-only or YouTube-partner-compliant primary playback.
- Headless Chrome capture of YouTube Music UI as the stream source.
- Spotify / Apple Music playback sources.
- Per-listener personal library (only linker’s account).
- Video track of the YouTube player.
- Dedicated control-bar Listen button.
- Listening contribution to Scoreboard.
- Default use of LiveKit Ingress/WHIP.

## Success signal

In one in-call demo: open Games and Apps → Apps / Games / Scoreboard; start Charades from Games still works; from Apps, link Google, start Shared Listening, play from search and from a playlist, queue a Music-library or search item, hear one synced stream on the listening tile, fail a bad URL and watch auto-skip, hand off DJ and skip without re-linking, leave and rejoin mid-track still hearing audio with correct chrome.

## Assumptions

- Host may force-end any listening session.
- Auto-skip delay defaults to 3 seconds; queue soft cap is 50.
- Spike may swap publish mechanism to WHIP without changing CAP-5’s success criteria (one room-wide bot audio track).
