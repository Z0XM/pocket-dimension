---
title: zeo Game Mode PRD
status: final
created: 2026-07-12
updated: 2026-07-12
supersedes_partial:
  - /workspace/_bmad-output/zeo/planning-artifacts/prds/prd-zeo-2026-06-27/prd.md
sources:
  - /workspace/_bmad-output/zeo/planning-artifacts/game-mode-charades-decisions.md
  - conversation: Party Mode planning 2026-07-12
  - /workspace/_bmad-output/zeo/planning-artifacts/prds/prd-zeo-2026-06-27/prd.md
---

# zeo Game Mode PRD

## Executive Summary

**zeo Game Mode** adds structured in-call games on top of the existing group video product. The host starts a game from the control bar; all participants switch to a dedicated **game view** with team-based video layouts, server-authoritative game state, and game-specific UI overlays. **Charades** is the first shipped game.

This release also **removes guest join from Zeo**. All participants — for calls and games — must be authenticated Better Auth users. That simplifies identity for teams, scoring, and game state.

Capacity limits unchanged: **2 concurrent rooms**, **6 participants per room**, self-hosted LiveKit on KVM 2.

## Problem Statement

Video calls work for conversation but lack lightweight structured play. Ad-hoc charades over generic video chat devolves into shouting, cheating, and no scorekeeping. zeo already owns the video surface, participant grid, and host controls — it can host the game rules, phase flow, and team layout without a separate app.

## Product Goals

### G-GM-1. Play without leaving the call
Participants run a full Charades session inside the existing room UI — no external tools, no screen-share of a third-party game.

### G-GM-2. Fair, server-owned game state
Votes, phase transitions, scoring, and Accept/Reject outcomes are authoritative on the server. Concurrent actions resolve deterministically.

### G-GM-3. Extensible game platform
Architecture supports future games (team counts up to 4, optional game tiles, game-scoped chat) without rewriting the shell.

### G-GM-4. Social scorekeeping
Room-level individual scoreboards persist across multiple games in one room session so groups can run several rounds or switch games and still see standings.

### G-GM-5. Authenticated-only Zeo
Removing guest join reduces abuse surface and aligns every participant with a stable `user.id` for teams and scores.

## Users and Roles

### Host (room creator)
- Starts, ends, and switches games.
- Configures game type and team count (where applicable).
- Force next round, restart round, decides when to stop.
- All existing host powers (end room, remove participant) remain.

### Player (authenticated participant)
- Joins game automatically when host starts (if in call).
- Plays Charades phases (suggest, vote, act, accept/reject, ready).
- Switches teams between rounds.
- Presses shuffle (re-assigns teams) when UI offers it in lobby / between rounds.

### Removed: Guest
- Guest join is **no longer supported** in Zeo (see FR-G0).

## User Journeys

### UJ-GM-1 — Anika hosts Friday charades
Anika (contributor, host) has five friends in a zeo call. She taps **Game Mode** on the control bar, selects **Charades**, and taps **Start Game**. Everyone's layout animates to two columns — Team A left, Team B right. The system auto-splits six players into teams of three. Round 1: Team A proposes. A floating suggestion tile appears for Team A only; they type ideas and vote. Maya taps **Pass On**; the locked word appears on Raj's tile (Team B's mime). Someone taps **Start Act**; Raj mimes; Team B shouts the answer. Team A taps **Accept**; Team B's column score ticks up. Everyone taps **Ready**; roles swap. After three games, the scoreboard tab shows cumulative individual points. Anika ends the game; the room returns to normal video layout. Scores remain for the room.

### UJ-GM-2 — Stuck round recovery
Mid-round, the mime's connection glitches. Anika opens the game panel and taps **Restart Round**. Suggestions and votes clear; the same teams replay the round from submission. No prior-round scores change.

### UJ-GM-3 — Unauthenticated visitor turned away
A friend opens the room link without logging in. Instead of a guest name field, they are prompted to **sign in** or **sign up** before entering the lobby. No guest token is issued.

### UJ-GM-4 — Team shuffle between rounds
After round 2, players want new teams. In the between-round ready phase, someone taps **Shuffle**; members redistribute across teams (still ≥2 per team). Players adjust with **Switch team** if needed, then mark **Ready**.

---

## Release Phase

| Phase | Focus |
|-------|--------|
| **Phase 4 — Game Mode MVP** | Guest removal, game shell, teams/layout, scoring, Charades, host controls |
| **Phase 4.1 — Polish** | Timers, host-migration on disconnect, late-join overlay |
| **Phase 4.2+** | Additional games, game-scoped team chat, opponent sub-team messaging |

---

## Functional Requirements

### Guest removal (prerequisite)

#### FR-G0-1 Authentication required to join
The system shall **reject** LiveKit token requests from unauthenticated clients. Guest name / guest identity flows shall be removed from Zeo.

#### FR-G0-2 Lobby sign-in gate
The pre-call lobby shall require a valid Better Auth session. Unauthenticated users shall be directed to sign in or sign up before device preview.

#### FR-G0-3 Guest UI removal
Guest-specific UI (guest badge, guest name entry, guest chat identity) shall be removed from Zeo client surfaces.

#### FR-G0-4 Guest API removal
The token endpoint shall not accept `guestName` or issue `guest_<uuid>` identities for Zeo rooms.

### Game mode shell

#### FR-GM-1 Game Mode control
The in-call control bar shall expose a **Game Mode** control. Only the **host** may open game configuration and start a game.

#### FR-GM-2 Game settings panel
Tapping Game Mode shall open a **game settings panel** (bottom-left, consistent with existing panel patterns). Opening it shall follow mutual-exclusion rules with other in-call panels (grid settings, devices).

#### FR-GM-3 Game selection
The host shall select a **game type** from available games. MVP ships **Charades** only; the selector shall allow future game types without UI redesign.

#### FR-GM-4 Team count configuration
For games that support variable teams, the host shall configure team count (**2–4**) before start. Charades is fixed at **2 teams** (FR-CH-1).

#### FR-GM-5 Start game
The host shall start the game explicitly. On start, all in-call authenticated participants enter **game view**.

#### FR-GM-6 End and switch game
Only the host may **end** the current game or **start a different game**. Ending returns participants to normal call layout (auto/grid as previously selected).

#### FR-GM-7 Game view layout mode
When a game is active, all participants shall use **game view** — a third stage layout mode alongside existing auto and grid. Grid/auto manual placement shall not apply during game view.

#### FR-GM-8 Optional game tile
Game view shall support an optional **centered game tile** for games that define one. Charades shall **not** use a centered game tile (FR-CH-21).

#### FR-GM-9 Game state sync
The server shall maintain authoritative game state. Clients shall receive state updates via **server-pushed events** (SSE). Clients shall send mutations via HTTP POST. Game state shall not rely on client-to-client messaging for correctness.

### Teams and layout

#### FR-GM-10 Auto-split teams
On game start, the system shall assign all in-call authenticated participants to teams automatically.

#### FR-GM-11 Shuffle button
The game panel shall expose a **Shuffle** button (action, not toggle). Pressing it shall randomly re-assign participants across teams subject to FR-GM-13. Shuffle shall be available in **lobby** and **between rounds**, not during active round phases.

#### FR-GM-12 Team switch
Participants may **switch teams** via the game panel **between rounds only**. Mid-round team changes shall be rejected.

#### FR-GM-13 Minimum team size
Each team shall have at least **2 members** when mathematically possible. Uneven team sizes are allowed (e.g. 3 vs 2). If participants cannot satisfy min-2-per-team for the configured team count, start/shuffle shall fail with a clear error.

#### FR-GM-14 Two-team layout
With 2 teams, game view shall place **Team A left, Team B right**.

#### FR-GM-15 Three-team layout
With 3 teams, all team tile groups shall appear on the **top** row.

#### FR-GM-16 Four-team layout
With 4 teams, teams 1–3 shall appear on **top**; team 4 on **bottom**.

#### FR-GM-17 Team-scored video tiles
Participant video tiles shall rearrange and group by team assignment in game view. Team identity shall be visually indicated (e.g. border tint per existing participant color patterns).

### Scoring

#### FR-GM-18 Team point propagation
When a team earns a point, **every member** of that team receives credit for the current game.

#### FR-GM-19 Per-game team scores
The active game shall track and display **team scores** during play.

#### FR-GM-20 Room individual scoreboard
The room shall maintain a **persistent individual scoreboard** aggregating points earned across all completed games in that room. Scores shall survive ending one game and starting another within the same room.

#### FR-GM-21 Force next round scoring
When the host forces next round, **no points** shall be awarded for that round.

#### FR-GM-22 Restart round scoring
When the host restarts a round, the system shall clear that round's suggestions and votes. **Previously awarded points shall not be reversed.**

### Game platform — chat and tiles (hooks for future games)

#### FR-GM-23 Ephemeral game chat
Game-scoped chat messages, when a game defines them, shall be deleted when the game session ends.

#### FR-GM-24 Team-internal chat
The platform shall support team-scoped chat channels for games that require them. Charades MVP uses the suggestion tile instead (FR-CH-4).

#### FR-GM-25 Opponent sub-team messaging
The platform shall support directed messaging to opponent sub-teams for games that require it. **Not required for Charades.**

#### FR-GM-26 Floating specialized tiles
Games may register **floating** UI tiles: draggable, rendered above video tiles, z-index above participant tiles.

#### FR-GM-27 Docked specialized tiles
Games may register **docked** tiles within the game layout grid.

### Charades — setup

#### FR-CH-1 Two teams
Charades shall use exactly **2 teams**.

#### FR-CH-2 Alternating roles
Teams shall alternate **proposing** (word selection) and **guessing** (mime + spoken guess) roles each round.

#### FR-CH-3 Minimum players
Charades shall require at least **4** authenticated participants in the call to start (minimum 2 per team).

#### FR-CH-21 No game tile
Charades shall not render a centered game tile.

### Charades — Phase 1: Submission

#### FR-CH-4 Suggestion tile visibility
During submission, members of the **proposing team** shall see a floating suggestion tile. Other participants shall not see it (client-side visibility in MVP).

#### FR-CH-5 Suggestion list
The tile shall list all submitted suggestions with **vote counts**. The highest-voted suggestion shall be visually highlighted.

#### FR-CH-6 Submit suggestion
Proposing-team members shall type a word and submit it as a suggestion.

#### FR-CH-7 Multi-vote
A participant may vote for **multiple** suggestions. Votes may be **changed** before the word is locked.

#### FR-CH-8 Pass On
When at least one suggestion has at least one vote, **Pass On** shall appear. Any proposing-team member may press it to **lock** the highest-voted suggestion (ties: highest vote count wins; further tie-break by earliest submission — see addendum).

#### FR-CH-9 Mime word reveal
After Pass On, the current **mime** (from guessing team) shall see the locked word. No think-time limit in MVP.

#### FR-CH-10 Start Act
Any participant from **either team** may press **Start Act** to begin the act phase.

### Charades — Phase 2: Act

#### FR-CH-11 Spoken guess
The guessing team shall guess **spoken aloud**. The UI shall not require typed guess entry.

#### FR-CH-12 Accept / Reject
During the act phase, the **proposing team** shall see **Accept** and **Reject** controls. Any proposing-team member may press either. The server shall record the **first valid** resolution; concurrent requests shall resolve to one outcome (others receive a clear "already decided" response).

#### FR-CH-13 Accept scoring
**Accept** awards **1 point** to the guessing team (FR-GM-18).

#### FR-CH-14 Reject scoring
**Reject** awards **no point**.

### Charades — Between rounds

#### FR-CH-15 Ready check
After Accept/Reject, all participants shall mark **Ready**. When **all** are ready, the next round begins with teams swapping proposing/guessing roles.

#### FR-CH-16 Mime rotation
The mime role shall rotate **within the guessing team** each round (round-robin over that team's members).

### Charades — Host controls

#### FR-CH-17 Force next round
The host may **force next round**, skipping unresolved round state. No score for that round (FR-GM-21).

#### FR-CH-18 Restart round
The host may **restart round**, clearing suggestions and votes for the current round (FR-GM-22).

#### FR-CH-19 End game
The host decides when to end the game. There is **no fixed win condition** in MVP.

#### FR-CH-20 Logged-in only
Only authenticated users may participate in Charades. This follows FR-G0.

---

## Non-Functional Requirements

#### NFR-GM-1 Game state latency
After a mutation (vote, pass-on, accept/reject, ready), participants shall see updated state within **500 ms** median under normal LAN/regional conditions (SSE delivery).

#### NFR-GM-2 Concurrency safety
Accept/Reject and phase transitions shall be safe under simultaneous requests from multiple clients without double-scoring or inconsistent phase.

#### NFR-GM-3 Reconnect resilience
A participant who disconnects and rejoins the call during an active game shall recover team assignment and game phase from server state within one SSE snapshot.

#### NFR-GM-4 Game chat ephemerality
When a game session ends, all game-scoped chat rows shall be deleted (cascade or explicit purge).

#### NFR-GM-5 Accessibility
Game panel controls and floating suggestion tile shall be keyboard-operable. Phase buttons shall expose aria labels (e.g. "Pass on word", "Accept guess").

#### NFR-GM-6 Mobile game panel
When a game is active, the Game Mode control shall remain reachable on mobile (not buried only in overflow menu).

#### NFR-GM-7 Auth hardening
All `/api/rooms/[slug]/game/*` endpoints shall require authenticated session and room membership.

#### NFR-GM-8 Capacity unchanged
Game mode shall not increase limits beyond 6 participants and 2 concurrent rooms.

---

## Success Metrics

| Metric | Target (Game Mode MVP) |
|--------|-------------------------|
| Charades round completion (happy path, no host force) | ≥ 90% of started rounds complete without host intervention |
| Accept/Reject race incidents (double score) | 0 in testing |
| SSE reconnect recovery | Participant resyncs within 2 s of rejoin |
| Guest token attempts after G0 | 0 successful issuances |

### Counter-metrics
- Do not add games beyond Charades until platform shell is stable.
- Do not add timers until core loop is validated without them.

---

## Out of Scope (Game Mode MVP)

- Phase timers (think time, act countdown)
- Additional games beyond Charades
- Opponent sub-team chat
- Server-side per-role payload filtering for suggestions
- Guest join (removed, not deferred)
- E2E encryption for game state
- AI word generation
- Breakout-style sub-rooms

---

## Dependencies and Assumptions

- Phase 1–3 zeo features shipped (video, screen share, chat, host controls).
- PostgreSQL 18, Drizzle migrations, `zeo` schema.
- auth-service and Better Auth session for all joins.
- `[ASSUMPTION]` Game participants are already in the LiveKit room when host starts game.
- `[ASSUMPTION]` Shuffle tie-break and team-switch UI use existing dark theme tokens.
- `[ASSUMPTION]` Host remains in call for duration of game (host migration TBD — see open items).

---

## Supersedes (original PRD)

The following original requirements are **superseded** for Zeo:

| Original | Replacement |
|----------|-------------|
| FR-1 (guest + auth join) | FR-G0-1, FR-G0-2 |
| FR-5 (guest join by link) | FR-G0-1 |
| FR-5a, FR-5b (guest name/identity) | Removed |
| FR-40 (guest join without account) | FR-G0-1 |
| NFR-12 (guest rate limiting) | Obsolete with guest removal |

Authenticated join, room lifecycle, capacity, and media FRs from the original PRD remain in effect.

---

## Open Questions

| # | Question | Status |
|---|----------|--------|
| OQ-1 | Host disconnect mid-game: pause vs auto-promote? | Deferred to architecture (Phase 4.1) |
| OQ-2 | Late joiner during active game: overlay copy and interactability? | Deferred to UX (Phase 4.1) |

None blocking Game Mode MVP implementation.
