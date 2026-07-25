# Epic — Games and Apps + Shared Listening

**Goal:** Convert Game mode into Games and Apps; ship Shared Listening (Discord-bot style LiveKit relay) as the first App.

**Spec:** `specs/spec-shared-listening/SPEC.md`  
**PRD:** `prds/prd-zeo-shared-listening-2026-07-25/`

Suggested order: spike → shell → OAuth → worker publish → queue UI → library/YTM → handoff polish.

---

### Story S0 — Playback spike (go/no-go)

**Capabilities:** CAP-5 (mechanism)  
**I want** proof that yt-dlp + LiveKit bot audio works on our stack,  
**So that** we do not build UI on an impossible publish path.

**Acceptance criteria**

- [ ] Resolve one public `videoId` with yt-dlp using linked-account-equivalent credentials path
- [ ] Publish audible audio into a LiveKit room as `listening-bot:*` via `@livekit/rtc-node`
- [ ] Stop/pause tears down cleanly
- [ ] If RTC bot fails, document WHIP trial result before proceeding

**Primary:** new worker spike harness; LiveKit dev room

---

### Story S1 — Games and Apps shell

**Capabilities:** CAP-1  
**I want** Apps / Games / Scoreboard under one panel,  
**So that** room activities share a single entry point.

**Acceptance criteria**

- [ ] Control bar shows Games and Apps for all authenticated participants
- [ ] Panel tabs: Apps, Games, Scoreboard
- [ ] Charades flows work from Games tab
- [ ] Scoreboard still shows `roomScores`
- [ ] Opening panel does not change stage layout
- [ ] Shortcut that opened Game mode opens this panel

**Primary files:** `ControlBar.svelte`, `GamePanel.svelte`, `CallExperience.svelte`

---

### Story S2 — Google link + session start/end

**Capabilities:** CAP-2, CAP-3  
**I want** to connect YouTube and start/end Shared Listening from Apps,  
**So that** the room can enter a listening session.

**Acceptance criteria**

- [ ] OAuth connect/disconnect; encrypted token storage
- [ ] Start requires link; starter becomes linker + DJ
- [ ] One session per room; End removes bot/queue/tile
- [ ] Host force-end works
- [ ] Unlink ends sessions where user is linker
- [ ] No control-bar Listen button

**Primary:** OAuth routes, `youtube_account_links`, listening session APIs, Apps card UI

---

### Story S3 — Music-worker bot audio + listening tile

**Capabilities:** CAP-5, CAP-6  
**I want** one shared audio stream and a Now Playing tile,  
**So that** everyone hears the same track with basic transport.

**Acceptance criteria**

- [ ] Worker plays/pauses/seeks/skips via jobs from zeo
- [ ] Bot hidden from camera grid; listening tile bound to bot audio
- [ ] SSE snapshot for now-playing + position + state
- [ ] Local listen volume on listening tile
- [ ] Late joiner hears audio + sees chrome

**Primary:** music-worker, `ListeningTile.svelte`, `stage-tiles.ts`, listening SSE

---

### Story S4 — Queue, search, URL paste, auto-skip

**Capabilities:** CAP-4, CAP-5  
**I want** a shared queue with search and URL add,  
**So that** the room can line up tracks.

**Acceptance criteria**

- [ ] Any participant can enqueue (cap 50); duplicates allowed
- [ ] Search + URL paste with source badges
- [ ] Auto-advance on end
- [ ] Failure → error ~3s → auto-skip
- [ ] DJ reorder/remove

**Primary:** queue APIs, Apps in-panel queue/search UI

---

### Story S5 — YouTube playlists + Liked library

**Capabilities:** CAP-4  
**I want** to browse the linker’s YouTube playlists and Liked,  
**So that** we can play from existing lists.

**Acceptance criteria**

- [ ] List playlists and items via Data API + linker OAuth
- [ ] Liked browse works
- [ ] Enqueue/play from library rows

**Primary:** library API routes, library UI

---

### Story S6 — YouTube Music library + search

**Capabilities:** CAP-4  
**I want** Music library/search for the linker,  
**So that** YTM collections are usable in-room.

**Acceptance criteria**

- [ ] Music library browse via InnerTube
- [ ] ytmsearch (or equivalent) results in unified search with badges
- [ ] Music section degrades without breaking YT playlists path

**Primary:** worker/InnerTube helpers, library music UI

---

### Story S7 — DJ handoff

**Capabilities:** CAP-5  
**I want** to hand transport controls to someone else without re-linking Google,  
**So that** the linker can stay the stream identity.

**Acceptance criteria**

- [ ] DJ transfer updates `dj_user_id` only
- [ ] New DJ can skip/seek; resolve still uses linker tokens
- [ ] Non-DJ cannot transport

**Primary:** `/listening/dj` API, tile/panel control gating
