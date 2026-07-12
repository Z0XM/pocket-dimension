---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - /workspace/_bmad-output/zeo/planning-artifacts/prds/prd-zeo-game-mode-2026-07-12/prd.md
  - /workspace/_bmad-output/zeo/planning-artifacts/prds/prd-zeo-game-mode-2026-07-12/addendum.md
  - /workspace/_bmad-output/zeo/planning-artifacts/architecture-game-mode.md
  - /workspace/_bmad-output/zeo/planning-artifacts/ux-designs/ux-zeo-game-mode-2026-07-12/DESIGN.md
  - /workspace/_bmad-output/zeo/planning-artifacts/ux-designs/ux-zeo-game-mode-2026-07-12/EXPERIENCE.md
---

# zeo Game Mode — Epic Breakdown (Phase 4)

## Overview

Epics and stories for **zeo Phase 4 — Game Mode + Charades MVP**, decomposed from the Game Mode PRD, UX, and Architecture artifacts. Builds on shipped Phase 1–3 zeo (video calling).

**Delivery order:** Epic 9 → 10 → 11 → 14 (backend) → 13 + 14 (UI) → 12 → 15

## Requirements Inventory

### Functional Requirements (Phase 4)

| Group | IDs |
|-------|-----|
| Guest removal | FR-G0-1 … FR-G0-4 |
| Game platform | FR-GM-1 … FR-GM-22 |
| Charades | FR-CH-1 … FR-CH-21 |

### Non-Functional Requirements

NFR-GM-1 … NFR-GM-8 (see Game Mode PRD)

### UX Requirements

UX-GM-1: Game view is dominant surface; phase banner provides context.  
UX-GM-2: Game panel bottom-left; mutual exclusion with grid/devices panels.  
UX-GM-3: Floating suggestion tile visible to proposing team only (client hide).  
UX-GM-4: Mobile promotes Game Mode button when game active.  
UX-GM-5: Accept/Reject race shows toast, not error modal.  
UX-GM-6: Auth gate replaces guest lobby path.

---

## Epic 9: Remove guest mode from Zeo (G0)

**Goal:** All zeo joins require authentication; guest code paths removed.

**Maps to:** FR-G0-1, FR-G0-2, FR-G0-3, FR-G0-4, FR-GM-22

### Story 9.1 — Require session for LiveKit token mint

**As the** system,  
**I want** the token endpoint to reject unauthenticated requests,  
**So that** only logged-in users join calls.

**Acceptance criteria:**
- [ ] `POST /api/rooms/[slug]/token` returns **401** without valid session
- [ ] `guestTokenSchema` and `guestName` body handling removed from `token/+server.ts`
- [ ] Guest rate-limit branch removed
- [ ] Authenticated flow unchanged: identity = `user.id`, display name from profile
- [ ] `guestTokenSchema` removed from `lib/validation/rooms.ts` (or deprecated unused)

### Story 9.2 — Auth gate on room route and lobby

**As an** unauthenticated visitor,  
**I want** a clear sign-in prompt when opening a room link,  
**So that** I can join after logging in.

**Acceptance criteria:**
- [ ] `/room/[slug]` redirects to `/login?redirect=/room/[slug]` when no session (FR-G0-2)
- [ ] `PreCallLobby.svelte` removes guest name input and guest-specific copy
- [ ] Lobby shows authenticated display name from profile
- [ ] Copy: primary **Sign in to join** on gate card (UX-GM-6)

### Story 9.3 — Remove guest identity from call UI and chat

**As a** developer,  
**I want** guest branches removed from in-call components,  
**So that** the codebase matches auth-only join.

**Acceptance criteria:**
- [ ] `CallExperience.svelte` — no `guestIdentity` / `guestName` state
- [ ] `ParticipantTile.svelte` — guest badge removed
- [ ] `VideoGrid.svelte` — no `isGuest` prop wiring
- [ ] `POST /api/rooms/[slug]/chat` requires session; no `guestIdentity` in body
- [ ] `chat.ts` / `ChatPanel.svelte` use session user id only
- [ ] `recordParticipantJoin` in `rooms.ts` always sets `isGuest: false` and `userId`

### Story 9.4 — Update docs and AGENTS.md for auth-only join

**As an** operator/developer,  
**I want** documentation to reflect auth-only zeo,  
**So that** setup instructions are accurate.

**Acceptance criteria:**
- [ ] `AGENTS.md` zeo section: guest join removed; login required
- [ ] No references to guest token flow in zeo `.env.example` comments

---

## Epic 10: Game mode shell and real-time sync (G1)

**Goal:** Database schema, SSE infrastructure, game panel entry point, and game view layout mode exist — no Charades gameplay yet.

**Maps to:** FR-GM-1, FR-GM-2, FR-GM-5, FR-GM-7, FR-GM-9, FR-GM-21, NFR-GM-1, NFR-GM-7

### Story 10.1 — Game database schema and migrations

**As a** developer,  
**I want** game tables in the `zeo` schema,  
**So that** server-authoritative state can persist.

**Acceptance criteria:**
- [ ] Drizzle schema in `shared/db/src/schema/zeo.ts` for: `game_sessions`, `game_teams`, `game_participants`, `game_rounds`, `game_suggestions`, `game_suggestion_votes`, `room_scores`
- [ ] Enums: `game_type`, `game_session_status`, `game_round_phase`, `game_verdict`
- [ ] `bun run db:migrate` succeeds on PostgreSQL 18
- [ ] FK cascades: session end deletes game rows; `room_scores` persists
- [ ] At most one active `game_sessions` per `room_id` (app guard + test)

### Story 10.2 — Game server modules and snapshot builder

**As a** developer,  
**I want** a snapshot builder and authz helpers,  
**So that** APIs return consistent game state.

**Acceptance criteria:**
- [ ] `lib/server/game/snapshot.ts` — `buildGameSnapshot(sessionId)` returns JSON per architecture §7
- [ ] `lib/server/game/authz.ts` — `requireGameParticipant`, `requireHost`, `requirePhase`
- [ ] `lib/server/game/sessions.ts` — stub `startGame` / `endGame` (teams only, no round)
- [ ] Unit test: empty session snapshot shape

### Story 10.3 — SSE event bus and events endpoint

**As a** participant in an active game,  
**I want** live state updates pushed to my client,  
**So that** I see phase changes without polling.

**Acceptance criteria:**
- [ ] `lib/server/game/event-bus.ts` — in-memory pub/sub per `sessionId`
- [ ] `GET /api/rooms/[slug]/game/events` — `text/event-stream`, requires session + room membership
- [ ] Sends `event: snapshot` on connect with full snapshot
- [ ] Sends `event: ping` every 30s
- [ ] `publish(sessionId)` called after mutations (wired in later stories)
- [ ] Connection closes cleanly when game ends

### Story 10.4 — Game session start/end API

**As the** host,  
**I want** to start and end a game session,  
**So that** the room enters and exits game mode.

**Acceptance criteria:**
- [ ] `POST /api/rooms/[slug]/game` — host only; body `{ gameType, teamCount }`; creates session `status: active`
- [ ] `DELETE /api/rooms/[slug]/game` — host only; sets `ended_at`, publishes final snapshot
- [ ] `GET /api/rooms/[slug]/game` — returns current snapshot or 404
- [ ] Non-host `POST` → 403
- [ ] Second active game in same room → 409

### Story 10.5 — Client game state store (SSE)

**As a** participant,  
**I want** my browser to subscribe to game events,  
**So that** UI reacts to server state.

**Acceptance criteria:**
- [ ] `lib/call/game-state.ts` — `connectGameSSE(slug)`, writable store, disconnect on leave
- [ ] Reconnect with exponential backoff on error
- [ ] Fallback `GET /game` on reconnect before SSE resumes
- [ ] `CallExperience.svelte` connects on game active; disconnects on end

### Story 10.6 — Game Mode control bar button and panel shell

**As the** host,  
**I want** a Game Mode button on the control bar,  
**So that** I can open game settings.

**Acceptance criteria:**
- [ ] `ControlBar.svelte` — Game Mode icon button; `aria-label="Game mode"`
- [ ] Host: visible always in call; non-host: visible only when game active (FR-GM-1)
- [ ] `GamePanel.svelte` — bottom-left panel shell with tabs **Setup** | **Scoreboard**
- [ ] Panel mutual exclusion with grid settings and devices (FR-GM-2)
- [ ] Mobile: Game button promoted to primary bar when game active (NFR-GM-6)
- [ ] Keyboard `G` toggles panel when not in text input

### Story 10.7 — Game view layout mode

**As a** participant,  
**I want** the stage to switch to game view when a game starts,  
**So that** video tiles use the game layout.

**Acceptance criteria:**
- [ ] `StageLayoutMode` extended with `"game"` in `stage-grid.ts`
- [ ] `CallExperience.svelte` sets `stageLayoutMode = "game"` when `session.status === "active"`
- [ ] Grid settings disabled during game (tooltip: end game to change layout)
- [ ] On game end, restore previous auto/grid mode
- [ ] `VideoGrid.svelte` branches on game mode (placeholder equal split until Epic 11)

---

## Epic 11: Teams engine and game layouts (G2)

**Goal:** Auto-split, shuffle, team switch, and team-based tile layouts for 2–4 teams.

**Maps to:** FR-GM-7, FR-GM-8, FR-GM-9, FR-GM-10–FR-GM-11, FR-GM-13, FR-CH-1, FR-CH-3

### Story 11.1 — Auto-split teams on game start

**As the** host starting Charades,  
**I want** players assigned to two teams automatically,  
**So that** we can begin without manual sorting.

**Acceptance criteria:**
- [ ] On `POST /game` with `gameType: charades`, creates 2 `game_teams` and assigns all in-call authenticated participants to `game_participants`
- [ ] Fisher-Yates shuffle then round-robin split
- [ ] Charades with &lt; 4 participants → 422 with clear message (FR-CH-3)
- [ ] Each team has ≥ 2 members when possible (FR-GM-13)
- [ ] Snapshot includes `teams[]` with `memberUserIds`

### Story 11.2 — Shuffle teams button

**As a** player between rounds,  
**I want** to reshuffle team assignments,  
**So that** we get fresh teams.

**Acceptance criteria:**
- [ ] `POST /api/rooms/[slug]/game/shuffle` — only when `round.phase === ready_check`
- [ ] Rebalances to min 2 per team; 422 if impossible
- [ ] Clears all `is_ready` flags
- [ ] Publishes SSE snapshot
- [ ] UI: **Shuffle teams** outline button in game panel (FR-GM-8)

### Story 11.3 — Switch team between rounds

**As a** player,  
**I want** to switch teams between rounds,  
**So that** I can balance sides.

**Acceptance criteria:**
- [ ] `POST /api/rooms/[slug]/game/teams/switch` — body `{ teamId }`; only `ready_check` phase
- [ ] Mid-round switch → 409
- [ ] UI: team dropdown in game panel for players (FR-GM-9)
- [ ] Clears self `is_ready` on switch

### Story 11.4 — Game layout algorithm (2/3/4 teams)

**As a** participant,  
**I want** video tiles grouped by team on screen,  
**So that** I can see my team and opponents clearly.

**Acceptance criteria:**
- [ ] `lib/call/game-layout.ts` — `computeGameLayoutFrames(teams, viewport, controlBarReservePx)`
- [ ] 2 teams: left / right columns (FR-GM-14)
- [ ] 3 teams: all top row (FR-GM-15)
- [ ] 4 teams: 3 top + 1 bottom (FR-GM-16)
- [ ] `VideoGrid.svelte` uses game layout frames when `layoutMode === "game"`
- [ ] Team header strip: name + score per column (from snapshot)

### Story 11.5 — Phase banner component

**As a** participant,  
**I want** a banner showing the current game phase,  
**So that** I know whose turn it is.

**Acceptance criteria:**
- [ ] `GamePhaseBanner.svelte` — top-center, `role="status"`, `aria-live="polite"`
- [ ] Copy per phase table in UX EXPERIENCE.md
- [ ] Visible whenever `session.status === "active"`
- [ ] Ready count shown during `ready_check`

---

## Epic 12: Scoring and room scoreboard (G3)

**Goal:** Team points during a game and persistent individual room scoreboard.

**Maps to:** FR-GM-12, FR-GM-13, FR-GM-14, FR-GM-18–FR-GM-20, FR-CH-13–FR-CH-14

### Story 12.1 — Award points on Charades accept

**As the** guessing team,  
**I want** our team score to increase when a guess is accepted,  
**So that** we can track who is winning.

**Acceptance criteria:**
- [ ] On verdict `accepted`: increment `game_teams.score` for guessing team
- [ ] Upsert `room_scores` for each guessing-team member (`total_score += 1`)
- [ ] Reject: no score change
- [ ] Snapshot includes per-team `score` and `roomScoreboard[]`

### Story 12.2 — Scoreboard tab UI

**As a** participant,  
**I want** to view individual scores across games,  
**So that** I can see standings for the night.

**Acceptance criteria:**
- [ ] `GameScoreboard.svelte` in Scoreboard tab: Player | Team dot | This game | Room total
- [ ] Room total persists after game ends (FR-GM-20)
- [ ] Team column headers show live team score during game (FR-GM-19)
- [ ] Brief score pulse animation on accept (UX DESIGN.md)
- [ ] `aria-live` announces score changes

### Story 12.3 — Force next and restart respect scoring rules

**As the** host,  
**I want** force/restart to follow scoring rules,  
**So that** scores stay fair.

**Acceptance criteria:**
- [ ] Force next round: no points awarded for skipped round (FR-GM-21) — implemented in Epic 15, verified here
- [ ] Restart round: suggestions/votes cleared; team and room scores unchanged (FR-GM-22)

---

## Epic 13: Floating tile framework (G4)

**Goal:** Reusable draggable overlay tiles for game-specific UI.

**Maps to:** FR-GM-19, FR-GM-20, FR-GM-26, FR-GM-27

### Story 13.1 — Floating tile container component

**As a** game module author,  
**I want** a draggable floating tile primitive,  
**So that** games can add overlays above video.

**Acceptance criteria:**
- [ ] `FloatingGameTile.svelte` — drag via header handle, `z-index` above tiles, `bg-card/95 backdrop-blur-md`
- [ ] Default position bottom-right above control bar reserve
- [ ] **Reset position** in overflow menu
- [ ] Position stored in `sessionStorage` per round; resets each round
- [ ] Keyboard: focusable, Escape closes if collapsible

### Story 13.2 — Mobile floating tile sheet

**As a** mobile player,  
**I want** the floating tile as a bottom sheet,  
**So that** it does not cover faces.

**Acceptance criteria:**
- [ ] ≤640px: collapsed pill "N suggestions" expands to half-height sheet
- [ ] Drag constrained to bottom 50% of stage on mobile
- [ ] Touch targets ≥ 44px for vote rows and Submit

---

## Epic 14: Charades round loop (G5)

**Goal:** Full Charades gameplay — submission through ready check.

**Maps to:** FR-CH-2, FR-CH-4–FR-CH-18, FR-CH-20, NFR-GM-2, NFR-GM-5

### Story 14.1 — Start Charades round and mime selection

**As the** system,  
**I want** to create rounds with proposing/guessing teams and mime,  
**So that** Charades alternates correctly.

**Acceptance criteria:**
- [ ] First round created on game start; `proposing_team_id` / `guessing_team_id` assigned
- [ ] `mime_user_id` = first member of guessing team; rotation index in `game_sessions.config`
- [ ] Phase starts at `submission`
- [ ] Subsequent rounds: teams swap roles; mime index increments within guessing team (FR-CH-16, FR-CH-17)

### Story 14.2 — Suggestion submit and vote API

**As a** proposing-team member,  
**I want** to suggest words and vote on suggestions,  
**So that** we pick a word democratically.

**Acceptance criteria:**
- [ ] `POST .../rounds/suggest` — `{ word }`, max 100 chars; proposing team only; phase `submission`
- [ ] `POST .../rounds/vote` — `{ suggestionId }` toggle vote; multi-suggestion votes allowed (FR-CH-7)
- [ ] `game_suggestion_votes` unique `(suggestion_id, voter_user_id)`
- [ ] Wrong team / phase → 403 / 409

### Story 14.3 — Floating suggestion tile UI

**As a** proposing-team member,  
**I want** to see and vote on suggestions in a floating tile,  
**So that** we coordinate privately from the guessing team.

**Acceptance criteria:**
- [ ] `FloatingSuggestionTile.svelte` uses `FloatingGameTile` shell
- [ ] Visible only when `showSuggestionTile(snapshot, userId)` (client hide, FR-CH-4)
- [ ] Lists suggestions sorted by vote count; leader highlighted (FR-CH-5)
- [ ] Input + Submit at bottom (FR-CH-6)
- [ ] Tap row to toggle vote

### Story 14.4 — Pass on and mime word reveal

**As a** proposing-team member,  
**I want** to lock the top-voted word and reveal it to the mime,  
**So that** the round can proceed.

**Acceptance criteria:**
- [ ] `POST .../rounds/pass-on` — requires ≥1 voted suggestion; locks highest votes (tie: earliest `created_at`)
- [ ] Phase → `passed_on`; `locked_word` set
- [ ] `MimeWordOverlay.svelte` on mime's tile only (FR-CH-9)
- [ ] **Pass On** button when votes exist (FR-CH-8)
- [ ] No think-time timer (FR-CH-10)

### Story 14.5 — Start act phase

**As any** participant,  
**I want** to start the act phase,  
**So that** the mime can perform.

**Acceptance criteria:**
- [ ] `POST .../rounds/start-act` — phase `passed_on` → `act`
- [ ] Any participant may call (FR-CH-11)
- [ ] UI: **Start act** in panel and phase banner action slot

### Story 14.6 — Accept / Reject verdict API

**As a** proposing-team member,  
**I want** to accept or reject the spoken guess,  
**So that** we score fairly.

**Acceptance criteria:**
- [ ] `POST .../rounds/verdict` — `{ verdict: "accepted" | "rejected" }`
- [ ] Phase must be `verdict` (auto-enter `verdict` when in `act` — or `act` accepts verdict POST per architecture)
- [ ] `SELECT FOR UPDATE` + phase guard; first write wins (FR-CH-12, NFR-GM-2)
- [ ] Concurrent requests: one 200, one 409 `{ error: "already_judged" }`
- [ ] Integration test with `Promise.all` concurrent accepts

### Story 14.7 — Accept / Reject UI

**As a** proposing-team member,  
**I want** Accept and Reject buttons during the act,  
**So that** I can judge the guess.

**Acceptance criteria:**
- [ ] Buttons visible to proposing team during act/verdict phases
- [ ] **Accept** primary, **Reject** outline
- [ ] 409 shows toast "Someone else already decided" (UX-GM-5)
- [ ] No typed guess UI anywhere (FR-CH-11)

### Story 14.8 — Ready check and next round

**As a** participant,  
**I want** to mark ready after a round,  
**So that** we proceed when everyone is set.

**Acceptance criteria:**
- [ ] `POST .../rounds/ready` — sets `game_participants.is_ready = true`
- [ ] When all ready: create next round, swap proposing/guessing teams, reset ready flags, phase `submission`
- [ ] **Ready** chip on own tile + panel button (FR-CH-15)
- [ ] Banner shows ready count

---

## Epic 15: Host game controls (G6)

**Goal:** Host force next, restart round, end game, and game type selection.

**Maps to:** FR-GM-3, FR-GM-4, FR-GM-6, FR-CH-17–FR-CH-19, FR-GM-15–FR-GM-16

### Story 15.1 — Host force next round

**As the** host,  
**I want** to skip to the next round,  
**So that** we recover from a stuck round.

**Acceptance criteria:**
- [ ] `POST .../rounds/force-next` — host only
- [ ] Ends current round without scoring (FR-CH-17, FR-GM-21)
- [ ] Creates next round or ends session if host chooses stop
- [ ] Confirm modal: "Skip this round? No points will be awarded."
- [ ] Idempotent under double-click

### Story 15.2 — Host restart round

**As the** host,  
**I want** to restart the current round,  
**So that** we replay from word selection.

**Acceptance criteria:**
- [ ] `POST .../rounds/restart` — host only
- [ ] Deletes suggestions and votes for current round; phase → `submission`
- [ ] Team scores and room scores unchanged (FR-CH-18)
- [ ] Confirm modal: "Clear suggestions and replay this round?"

### Story 15.3 — End game and return to call

**As the** host,  
**I want** to end the game and return to normal video layout,  
**So that** we can chat or start another game.

**Acceptance criteria:**
- [ ] **End game** in panel — destructive confirm (FR-GM-4, FR-CH-19)
- [ ] `DELETE /game` ends session; SSE closes; layout returns to auto/grid
- [ ] Scoreboard tab shows final standings; **Play again** returns host to Setup
- [ ] Only host can start a different game type (FR-GM-6)

### Story 15.4 — Game type selector (Charades only)

**As the** host,  
**I want** to select Charades from game setup,  
**So that** the platform is ready for future games.

**Acceptance criteria:**
- [ ] Setup tab: game type select with **Charades** as sole option (FR-GM-3)
- [ ] Team count pills shown; locked to 2 for Charades (FR-CH-1)
- [ ] **Start game** disabled with hint when &lt; 4 players

---

## Epic Summary

| Epic | Phase | Stories | Theme |
|------|-------|---------|-------|
| 9 | 4 | 9.1–9.4 | Remove guest mode |
| 10 | 4 | 10.1–10.7 | Game shell + SSE + panel |
| 11 | 4 | 11.1–11.5 | Teams + layouts + banner |
| 12 | 4 | 12.1–12.3 | Scoring + scoreboard |
| 13 | 4 | 13.1–13.2 | Floating tile framework |
| 14 | 4 | 14.1–14.8 | Charades full loop |
| 15 | 4 | 15.1–15.4 | Host controls + setup |

**Phase 4 story count:** 34 implementable stories across Epics 9–15.

## Suggested sprint order

1. **Epic 9** (all) — guest removal prerequisite  
2. **Epic 10.1–10.5** — schema + SSE + client store  
3. **Epic 10.6–10.7** + **Epic 11.4–11.5** — visible game shell (empty layout)  
4. **Epic 11.1–11.3** — teams  
5. **Epic 14.1–14.2, 14.4–14.6, 14.8** — Charades backend (no UI)  
6. **Epic 13** + **Epic 14.3, 14.5, 14.7** — Charades UI  
7. **Epic 12** — scoring + scoreboard  
8. **Epic 15** — host controls  
9. **Epic 14.6 integration tests** + manual 4-browser Charades test  

## Traceability (selected)

| Story | PRD |
|-------|-----|
| 9.x | FR-G0-* |
| 10.6–10.7 | FR-GM-1, FR-GM-2, FR-GM-5, FR-GM-7 |
| 11.x | FR-GM-8–11, FR-GM-13–16 |
| 12.x | FR-GM-12–14, FR-GM-18–22 |
| 13.x | FR-GM-19–20, FR-GM-26–27 |
| 14.x | FR-CH-* |
| 15.x | FR-GM-3–4, FR-GM-6, FR-CH-17–19 |

## Out of scope (Phase 4.1+)

- Phase timers (think time, act countdown)
- Host disconnect auto-promote
- Late joiner mid-game overlay
- `game_chat_messages` table usage
- Second game type beyond Charades selector stub
- Server-side suggestion payload filtering
