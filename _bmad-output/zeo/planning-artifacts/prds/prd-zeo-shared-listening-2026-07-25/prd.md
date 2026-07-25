---
title: zeo Games and Apps — Shared Listening PRD
status: draft
created: 2026-07-25
updated: 2026-07-25
sources:
  - /workspace/_bmad-output/zeo/planning-artifacts/shared-listening-decisions.md
  - conversation: shared listening planning 2026-07-25
  - /workspace/_bmad-output/zeo/planning-artifacts/prds/prd-zeo-game-mode-2026-07-12/prd.md
---

# zeo Games and Apps — Shared Listening PRD

## Executive Summary

This release converts zeo’s in-call **Game mode** into **Games and Apps** — a panel with tabs **Apps**, **Games**, and **Scoreboard** — and ships **Shared Listening** as the first App.

Shared Listening lets one participant link their Google / YouTube account, then play YouTube and YouTube Music tracks for the whole room. A server **music-worker** resolves audio (Discord-bot style) and publishes a single LiveKit bot track so everyone hears the same stream. Queue, transport, and library UI live in zeo.

Capacity unchanged: **2 rooms × 6 participants**, self-hosted LiveKit on KVM 2.

**Accepted risk:** stream extraction redistributes YouTube media outside official embeds (same gray area as Discord music bots). Product is personal / friend-group; do not market as an official YouTube integration.

## Problem Statement

Friends already gather in zeo calls but share music by screen-sharing a YouTube Music tab — no shared queue, no Now Playing chrome, and no single synced source. Official embeds cannot drive YouTube Music natively or guarantee ad-free sync. A room-owned listen session with one linked account and one relayed audio stream matches how groups already use Discord music bots, inside zeo’s call stage.

## Product Goals

### G-SL-1. Games and Apps shell
One control-bar entry for room activities: Apps catalog, Games (Charades), and Scoreboard — without separate Listen chrome on the control bar.

### G-SL-2. Shared listen without leaving the call
Participants start Shared Listening from Apps, hear the same audio in-call, and manage queue/transport in zeo.

### G-SL-3. One linked account for the session
The participant who starts Listening links Google; that **linker** identity is used for library fetch and stream resolve for the whole session, even if DJ controls hand off.

### G-SL-4. Library + search
Participants can play from the linker’s YouTube playlists / Liked **and** YouTube Music library, plus search and paste URLs.

### G-SL-5. Server-owned queue and playback state
Queue order, now-playing, and transport state are authoritative on the server (HTTP + SSE), with a music-worker driving the LiveKit bot.

## Users and Roles

### Linker
- Connects Google / YouTube via OAuth.
- Becomes linker when they **Start** Shared Listening (also initial DJ).
- Their credentials power library + resolve until the session ends or they unlink.

### DJ
- Controls play / pause / seek / skip / previous / queue reorder-remove.
- Defaults to linker; may hand off to another participant without changing linker credentials.

### Participant (any authenticated room member)
- May start Shared Listening (becomes linker + DJ).
- May enqueue via search, URL, or library (when session active).
- Hears bot audio; adjusts local listen volume on the listening tile.
- Opens Games and Apps for Apps / Games / Scoreboard.

### Host (room creator)
- Retains existing host powers (end room, remove participant, start/end Charades).
- May force-end Shared Listening if needed for room hygiene. `[ASSUMPTION: host can force-end any listening session]`

## Glossary

- **Games and Apps** — In-call panel (formerly Game mode) with tabs Apps, Games, Scoreboard.
- **App** — Non-game room activity listed under the Apps tab (Shared Listening is the first).
- **Shared Listening** — The App that plays one room-wide music stream via a LiveKit bot.
- **Linker** — User whose Google tokens the session uses for library and stream resolve.
- **DJ** — User allowed to transport-control the Shared Listening session.
- **Listening bot** — Server LiveKit participant (`listening-bot:{roomId}`) that publishes the music audio track.
- **Music-worker** — Long-lived Bun/Node process that resolves media and publishes bot audio.
- **Listening tile** — Stage tile (`kind: listening`) showing Now Playing chrome for the session.
- **Scoreboard** — Existing per-room individual game scores; not used by Shared Listening.

## User Journeys

### UJ-SL-1 — Start Shared Listening
Maya is in a zeo call with friends. She opens **Games and Apps** → **Apps** → **Shared Listening**. She connects Google when prompted, taps **Start**. A listening tile appears; the listening bot joins the room. She searches a song, hits play; everyone hears it on the same stream.

### UJ-SL-2 — Queue from library
Raj (participant) opens the active Listening controls, browses Maya’s playlists and Music library, and queues three tracks. When the current song ends, the next starts automatically.

### UJ-SL-3 — Unplayable track
A queued item fails to resolve. The tile shows an error for ~3 seconds, then **auto-skips** to the next queue item.

### UJ-SL-4 — DJ handoff
Maya transfers DJ to Priya. Priya can skip/seek; streams still resolve with **Maya’s** linked Google account.

### UJ-SL-5 — Late join
Dev joins mid-track. He immediately hears the bot audio via LiveKit and sees Now Playing + queue from SSE — no catch-up download.

### UJ-SL-6 — Games tab still works
Host Anika opens Games and Apps → **Games**, starts Charades. Game layout engages as today. Scoreboard tab still shows room game scores. Shared Listening may remain active (MVP allows both).

## Release Phase

| Phase | Focus |
|-------|--------|
| **0 — Spike** | OAuth/cookies → yt-dlp one track → `@livekit/rtc-node` bot audible (go/no-go) |
| **1a — Shell** | Rename to Games and Apps; tabs Apps / Games / Scoreboard; Charades under Games |
| **1b — Listening MVP** | Link, start/stop, search+URL, YT playlists/Liked, queue, transport, bot audio, auto-skip, listening tile |
| **1c — YTM library** | Music library browse + ytmsearch hardening |
| **2 — Polish** | DJ handoff UX, playlist enqueue-all (capped), worker health banner |

---

## Functional Requirements

### Games and Apps shell

#### FR-GA-1 Games and Apps control
The in-call control bar shall expose **Games and Apps** (replacing “Game mode”). The control shall be visible to **all** authenticated participants. Realizes UJ-SL-1, UJ-SL-6.

**Consequences:**
- Labels/aria use “Games and Apps”.
- Opening the panel follows existing mutual exclusion with chat, devices, and grid settings.

#### FR-GA-2 Three tabs
The panel shall provide tabs **Apps**, **Games**, and **Scoreboard** (in that order). Realizes UJ-SL-1, UJ-SL-6.

#### FR-GA-3 Apps catalog
The Apps tab shall list available Apps. MVP ships **Shared Listening** with idle / needs-link / active states and actions (Connect, Start, Open, End as applicable). Realizes UJ-SL-1.

#### FR-GA-4 Games tab
The Games tab shall host Charades start/config/in-game controls previously under Setup. Host-only start/end rules for games remain as in the Game Mode PRD. Realizes UJ-SL-6.

#### FR-GA-5 Scoreboard tab
The Scoreboard tab shall continue to show `roomScores` (game scores). Shared Listening shall not write scoreboard rows. Realizes UJ-SL-6.

#### FR-GA-6 Layout independence
Opening Games and Apps shall not change stage layout. Starting a **game** still forces game layout. Starting **Shared Listening** shall **not** force game layout; it adds a listening tile. Realizes UJ-SL-1, UJ-SL-6.

#### FR-GA-7 No dedicated Listen control-bar button
Shared Listening shall be entered only via the Apps tab (not a separate control-bar Listen control). Realizes UJ-SL-1.

### Account linking

#### FR-SL-1 Google OAuth link
An authenticated user shall connect Google with YouTube-capable scopes sufficient for playlist/liked reads and worker resolve needs. Realizes UJ-SL-1.

#### FR-SL-2 Encrypted token storage
Refresh (and access) tokens shall be stored encrypted at rest and never sent to browsers. Realizes UJ-SL-1.

#### FR-SL-3 Unlink
A user shall disconnect Google; tokens are deleted; any active Shared Listening session that uses them as linker shall end. Realizes UJ-SL-6.

#### FR-SL-4 Linker sticky credentials
For a listening session, `linker_user_id` is fixed at start; the music-worker shall use that user’s credentials for resolve/library regardless of `dj_user_id`. Realizes UJ-SL-4.

### Session lifecycle

#### FR-SL-5 Who may start
Any authenticated room participant may start Shared Listening if no session is active; they become linker and initial DJ (must complete Google link first if not linked). Realizes UJ-SL-1.

#### FR-SL-6 One session per room
At most one Shared Listening session per room. Realizes UJ-SL-1.

#### FR-SL-7 End session
DJ or linker may end the session; host may force-end. Ending stops the worker job, removes the listening bot, clears queue, removes the listening tile. Realizes UJ-SL-1.

#### FR-SL-8 Room end cleanup
Ending the zeo room shall end any listening session and tear down the bot/worker job.

### Library and search

#### FR-SL-9 YouTube playlists and Liked
Using the linker’s OAuth, the system shall list YouTube playlists and Liked videos for browse/enqueue. Realizes UJ-SL-2.

#### FR-SL-10 YouTube Music library
The system shall expose YouTube Music library browse (and related Music search) via the linker’s account (InnerTube). If Music endpoints fail, the UI shall degrade that section while YouTube playlists/search remain available. Realizes UJ-SL-2.

#### FR-SL-11 Search and URLs
Participants shall search (YT and/or YTM) and paste YouTube / youtu.be / shorts / music.youtube.com watch URLs to resolve a `videoId`. Results show source badges. Realizes UJ-SL-1, UJ-SL-2.

### Queue and transport

#### FR-SL-12 Server-authoritative queue
Queue order, now-playing, playback state, and position shall be server-authoritative; clients sync via SSE. Realizes UJ-SL-2, UJ-SL-5.

#### FR-SL-13 Enqueue
Any participant may enqueue (cap **50** items). Duplicates allowed. Rows show title, art, source badge, added-by. Realizes UJ-SL-2.

#### FR-SL-14 DJ transport
DJ may play, pause, seek, skip, previous, reorder, and remove queue items. Realizes UJ-SL-1, UJ-SL-4.

#### FR-SL-15 Auto-advance and auto-skip
On natural track end, play next. On resolve/play failure, show error ~**3s** then auto-skip to next (or idle if empty). Realizes UJ-SL-3.

#### FR-SL-16 DJ handoff
DJ may transfer transport role to another participant; linker unchanged. Realizes UJ-SL-4.

### Playback (music-worker + LiveKit)

#### FR-SL-17 Bot audio publish
While a track plays, a listening bot shall publish one audio track into the room’s LiveKit session so all participants hear the same stream. Realizes UJ-SL-1, UJ-SL-5.

#### FR-SL-18 Bot identity hidden from camera grid
The listening bot shall not appear as a normal participant camera tile; audio is presented via the listening tile. Realizes UJ-SL-1.

#### FR-SL-19 Audio-only MVP
MVP shall relay **audio only** (no video track of the YouTube player). Realizes UJ-SL-1.

### UI — listening tile and panel

#### FR-SL-20 Listening tile
When a session is active, the stage shall show a listening tile with artwork, title, channel/artist, scrubber, and DJ transport controls. Realizes UJ-SL-1.

#### FR-SL-21 Local listen volume
Listeners shall adjust how loud the listening tile is for them (existing per-tile volume / listen-mute patterns). Realizes UJ-SL-5.

#### FR-SL-22 In-panel app controls
While Shared Listening is active, Games and Apps (Apps context) shall expose queue, library, and search controls. Realizes UJ-SL-2.

### Coexistence

#### FR-SL-23 With call media
Shared Listening may run alongside mic/cam and screen share. Screen share remains layout-dominant when present; listening tile stays available (e.g. sidebar/rail). Realizes UJ-SL-1.

#### FR-SL-24 With games
MVP shall allow Shared Listening and an active game concurrently unless a hard technical conflict forces a mutex (document if introduced). Realizes UJ-SL-6.

---

## Non-Functional Requirements

#### NFR-SL-1 Capacity
Respect ≤2 concurrent rooms and ≤6 participants; ≤1 listening bot per room; ≤2 worker playback jobs cluster-wide.

#### NFR-SL-2 Sync transport
Listening state push via **SSE**; mutations via **HTTP** (same pattern as game mode). LiveKit carries media only for music audio (bot track).

#### NFR-SL-3 Worker isolation
Playback shall run in a separate music-worker process (not inside request handlers).

#### NFR-SL-4 Security
Google tokens encrypted at rest; LiveKit bot tokens minted server-side only; library/resolve endpoints require room membership.

#### NFR-SL-5 Resilience
Extractor failures shall surface in UI; Apps card may show maintenance state; YTM degradation must not break YT playlist path.

#### NFR-SL-6 Honesty
UI copy shall not claim official YouTube partnership or “YouTube Music Connect.”

---

## Out of Scope

- Official YouTube/Google partnership or ToS-compliant IFrame-only playback as the primary path
- WHIP/LiveKit Ingress as default publish path (spike fallback only)
- Video relay of the YouTube player
- Writing Shared Listening activity into the Scoreboard
- Separate control-bar Listen button
- Spotify / Apple Music as playback sources
- Per-listener personal Google library (only linker’s library)

## Success Metrics

| Signal | Evidence |
|--------|----------|
| Shell | In-call demo: Games and Apps opens with Apps / Games / Scoreboard; Charades still startable from Games |
| Listen | One linker starts Shared Listening; room hears one synced track; queue advances; failed track auto-skips |
| Library | Browse YT playlist + Music library item into queue |
| Handoff | DJ transfers; new DJ skips; audio still plays using original linker |

## Assumptions

- `[ASSUMPTION]` Host may force-end Shared Listening.
- `[ASSUMPTION]` Auto-skip delay defaults to 3 seconds.
- `[ASSUMPTION]` Queue soft cap is 50.
- Spike (Phase 0) may force publish-path fallback to WHIP; product FRs stay “one room-wide bot audio track.”

## Open Questions

None blocking — decisions locked in `shared-listening-decisions.md` §8. Spike may reopen publish mechanism only.
