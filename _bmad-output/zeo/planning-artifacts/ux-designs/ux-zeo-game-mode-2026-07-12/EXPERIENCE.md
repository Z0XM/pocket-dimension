---
title: zeo Game Mode UX Experience
status: final
created: 2026-07-12
updated: 2026-07-12
sources:
  - /workspace/_bmad-output/zeo/planning-artifacts/prds/prd-zeo-game-mode-2026-07-12/prd.md
  - /workspace/_bmad-output/zeo/planning-artifacts/ux-designs/ux-zeo-game-mode-2026-07-12/DESIGN.md
  - /workspace/apps/zeo/DESIGN.md
  - /workspace/_bmad-output/zeo/planning-artifacts/ux-designs/ux-zeo-2026-06-27/EXPERIENCE.md
---

# Foundation

- **Product focus:** in-call structured games on top of zeo video (Charades MVP)
- **Form factor:** web first — desktop primary (`≥1024px`); tablet (`768–1023px`); mobile (`≤640px`) supported for game panel + simplified layouts
- **Visual identity:** `DESIGN.md` (game mode delta) extending `apps/zeo/DESIGN.md`
- **UI system:** shadcn-svelte + Tailwind (behavioral deltas only here)
- **New core surfaces:** game settings panel, game view stage, floating suggestion tile, phase banner, scoreboard tab
- **Removed surfaces:** guest name entry in lobby

> Spines win on conflict with wireframes or implementation sketches.

# Information Architecture

## Updated routes (unchanged paths, new states)

| Route | States |
|-------|--------|
| `/room/[slug]` | `lobby` → `in_call` → `in_call + game_active` → `in_call` (game ended) |
| `/login`, `/sign-up` | Required before lobby when unauthenticated |

## In-call surface map

```
CallExperience
├── CallStage (game view | auto | grid)
│   ├── Team columns / rows (game view)
│   ├── Phase banner (game active)
│   ├── FloatingSuggestionTile (Charades, proposing team only)
│   └── MimeWordOverlay (mime tile only)
├── ControlBar
│   └── Game Mode button
├── GamePanel (bottom-left / mobile sheet)
│   ├── Tab: Setup (host)
│   ├── Tab: Scoreboard (all)
│   └── In-game: Shuffle, Force next, Restart, End
├── ChatPanel (unchanged; orthogonal)
└── GridSettingsPanel (hidden/disabled while game active)
```

## Panel mutual exclusion

| Panel open | Closes |
|------------|--------|
| Game panel | Grid settings, devices |
| Grid settings | Game panel, devices |
| Devices | Game panel, grid settings |

While `game_active`: grid settings **disabled** (tooltip: "End game to change layout"). Chat remains available.

## Game view layout modes (by team count)

| Teams | Layout |
|-------|--------|
| 2 | Left column / right column (Charades) |
| 3 | Three columns, single top row |
| 4 | Teams 1–3 top row; team 4 bottom row centered |

# Voice and Tone

- Playful but clear: **"Team A picks the word"** not "Submission phase initiated".
- Phase transitions: short present tense — **"Raj is miming"**, **"Waiting for everyone to be ready"**.
- Host recovery actions: neutral, non-judgmental — **"Restart this round?"** not "Round failed".
- Errors: actionable — **"Need at least 4 players to start Charades"**.
- 409 accept/reject: **"Someone else already decided"** (toast, 3s).
- Guest removal: **"Sign in to join this call"** — no guilt, no marketing.

# Component Patterns

## Auth gate (replaces guest lobby path)

**Unauthenticated user opens room link:**
1. Redirect or inline gate on `/room/[slug]` before device preview.
2. Show room name if public metadata available.
3. Primary: **Sign in** → `/login?redirect=/room/[slug]`
4. Secondary: **Create account** → `/sign-up?redirect=...`
5. No display-name-only join.

**Authenticated lobby (updated):**
- Display name from profile (optional per-call edit retained if already shipped).
- Remove guest badge paths.
- Participant count: "4 of 6 joined" (all authenticated).

## Game settings panel — Setup tab (host)

| Element | Behavior |
|---------|----------|
| Game type | Select; MVP: Charades only (disabled select with single option OK) |
| Team count | Pills 2–4; Charades locks **2** (pills disabled, visual lock icon) |
| Start game | Primary; disabled if `< 4` players or teams cannot satisfy min 2 |
| Inline hint | If 3 players: "Charades needs at least 4 players" |

On **Start game:**
1. POST start → SSE connects.
2. Stage animates to game view (200ms).
3. Panel auto-collapses on mobile; stays open on desktop (host preference: collapse after 3s optional `[ASSUMPTION]`).

## Game settings panel — in-game (host)

| Control | Phase availability | Effect |
|---------|-------------------|--------|
| Force next round | Any active round | Confirm: "Skip this round? No points will be awarded." |
| Restart round | Any active round | Confirm: "Clear suggestions and replay this round?" |
| End game | Any | Confirm: "End Charades? Scores stay on the scoreboard." |
| Shuffle teams | `ready_check` only | Immediate reshuffle; resets all ready flags |

## Game settings panel — players (non-host)

- **Scoreboard** tab always available.
- **Setup** tab hidden.
- Read-only **Game status** section: current phase, round number, team assignment.
- **Switch team** dropdown: only during `ready_check`; lists other teams with capacity hint.

## Control bar — Game Mode button

| Actor | State | Behavior |
|-------|-------|----------|
| Host | No game | Opens Setup tab |
| Host | Game active | Opens panel to host controls / scoreboard |
| Player | Game active | Opens scoreboard + status |
| Anyone | No game | Hidden for non-host |

Keyboard: `G` toggles game panel when game active (when not in text input).

## Phase banner copy

| Phase | Banner text |
|-------|-------------|
| `submission` | "{Team} is choosing a word" |
| `passed_on` | "Word locked — {MimeName} is thinking" |
| `act` | "{MimeName} is miming" |
| `verdict` | "{Team} — was the guess right?" (proposing team sees Accept/Reject below banner on mobile) |
| `ready_check` | "Ready for next round? ({n}/{total} ready)" |

## Charades — Floating suggestion tile

**Visible to:** proposing team members only (client-side; `teamId === proposingTeamId && phase === submission`).

| Zone | Content |
|------|---------|
| Header | Drag handle, "Suggestions", ⋮ menu → Reset position |
| List | Suggestions sorted by votes desc, then created_at asc |
| Row | Word, vote count, tap row to toggle vote |
| Footer | Input + Submit |
| Pass On | Shown when `maxVotes > 0`; any proposing member can tap |

**Vote interaction:**
- Tap suggestion row → add vote (toggle off if same row tapped again `[ASSUMPTION: tap toggles vote on that suggestion]`).
- User may vote multiple suggestions.
- Leader row: `{colors.voteLeader}` accent per DESIGN.md.

**Mobile (`≤640px`):**
- Default: collapsed pill bottom-center — "💬 {n} suggestions" → expands to half-height sheet.
- Drag constrained to bottom 50% of stage.

## Charades — Mime word overlay

**Visible to:** current mime only, phases `passed_on` through `act` until round ends.

- Overlay on own video tile only.
- Word in large text; scrim does not obscure drag handles on tile action bar.

## Charades — Start Act

- Button location: game panel + phase banner action slot.
- Visible: phases `passed_on` and early `act` (before act officially started).
- Label: **Start act**
- Any player may press.

## Charades — Accept / Reject

**Visible to:** proposing team, phase `act` (mime performing).

- **Accept** / **Reject** buttons in game panel sticky footer (mobile) or below phase banner (desktop).
- First server resolution wins; others get toast.
- On Accept: team score animates (+1); `aria-live` announces "{Team B} scores!"

## Charades — Ready check

- Each player: **Ready** button on own tile (bottom-right chip) OR in game panel.
- All ready → automatic phase transition; brief banner "Round {n+1}".
- Shuffle + team switch enabled in panel during this phase only.

## Scoreboard tab

| Column | Description |
|--------|-------------|
| Player | Display name |
| Team | Color dot |
| This game | Points this game session |
| Room total | Cumulative across games in room |

When game ends, panel defaults to Scoreboard tab with **Play again** (host → Setup) and **Done** (dismiss panel).

## Late joiner overlay (Phase 4.1 — spine default)

`[ASSUMPTION]` MVP: 3-second toast/banner on join mid-game: "Charades in progress — you're on {Team}". No block.

## Host disconnect (Phase 4.1 — TBD)

Spine placeholder: full-screen pause "Waiting for host…" — implementation deferred.

# State Patterns

## Call + game composite states

```
in_call: normal
in_call + game_lobby: teams assigned, waiting for round 1
in_call + game_active: { phase: submission | passed_on | act | verdict | ready_check }
in_call + game_ended: scoreboard visible, normal layout restored
```

## Tile states (game view)

- `speaking` — existing active speaker ring (unchanged).
- `mime` — subtle `{colors.gameAccent}` badge "MIME" on tile.
- `self_ready` — ready chip filled on own tile.
- `minimized` — existing minimize behavior disabled during game `[ASSUMPTION]` or minimized tiles restored on game end.

## Panel states

- `gamePanelOpen: boolean`
- `gamePanelTab: 'setup' | 'scoreboard'`
- `floatingTilePosition: { x, y }` — sessionStorage per round (reset each round).

# Interaction Primitives

- **Drag:** floating suggestion tile via header handle only (not whole tile — avoids accidental drags when voting).
- **Keyboard:** `G` game panel; `Escape` close panel; floating tile input focusable via `Tab`.
- **Confirm modals:** host destructive actions only (end game, force next, restart).
- **Toasts:** 409 conflicts, shuffle success, game started.
- **SSE disconnect:** existing connection banner pattern + "Game state syncing…" subtext.

# Accessibility Floor

- Game Mode button: `aria-label="Game mode"`, `aria-expanded` when panel open.
- Phase banner: `role="status"` `aria-live="polite"`.
- Suggestion list: `role="listbox"` with `aria-selected` on voted items.
- Accept/Reject: explicit labels "Accept guess" / "Reject guess".
- Ready button: `aria-pressed`.
- Team switch: native `select` or radiogroup with team names announced.
- Floating tile: keyboard-reposition via Reset position menu (drag not required).
- Color not sole indicator for vote leader (add vote count text + icon).

# Key Flows

## Flow GM-1 — Anika hosts Friday charades (climax: first Accept scores)

1. Anika and five friends are authenticated in a zeo call.
2. Anika taps **Game Mode** → selects Charades → **Start game**.
3. **Climax:** stage splits into two columns; floating tile appears for Team A; banner reads "Team A is choosing a word".
4. Team A suggests "elephant", votes; Maya taps **Pass On**.
5. Raj (mime) sees word on his tile; someone taps **Start act**.
6. Team B shouts guess; Anika taps **Accept** — Team B score ticks to 1.
7. All tap **Ready**; roles swap; round 2 begins.

## Flow GM-2 — Stuck round recovery (climax: restart without score loss)

1. Mid-submission, suggestions pile up; confusion about phase.
2. Anika opens game panel → **Restart round** → confirms.
3. **Climax:** floating tile clears; banner returns to "Team A is choosing a word"; team scores unchanged.

## Flow GM-3 — Marco turned away at door (climax: sign-in gate)

1. Marco opens room link logged out.
2. Sees room title + **Sign in to join** (no guest name field).
3. **Climax:** after login, lands in lobby with device preview — same as other authenticated users.

## Flow GM-4 — Shuffle between rounds (climax: new teams before ready)

1. Round ends; phase `ready_check`; banner shows "0 of 6 ready".
2. Player taps **Shuffle teams** in panel.
3. Columns animate members to new sides; ready flags cleared.
4. Players switch teams if needed; all mark **Ready**.
5. **Climax:** round starts with fresh teams.

## Flow GM-5 — Race on Accept (climax: toast, single score)

1. Team B guesses; two Team A members tap **Accept** simultaneously.
2. One succeeds; other sees toast "Someone else already decided".
3. **Climax:** score increments once only; phase moves to ready check.

# Responsive & Platform

## Desktop (`≥1024px`)

- Two-column Charades layout with vertical tile stacks.
- Floating tile bottom-right default.
- Game panel 320px bottom-left.
- Accept/Reject inline below phase banner.

## Tablet (`768–1023px`)

- Same column split; smaller tiles (reuse gallery density scaling).
- Game panel overlays stage bottom-left.

## Mobile (`≤640px`)

- Single-column team stack (Team A block, divider, Team B block).
- Game Mode button promoted to primary control bar when game active.
- Game panel = bottom sheet 70vh max.
- Floating tile = collapsible bottom sheet.
- Accept/Reject sticky at bottom of game panel.

# Inspiration & Anti-patterns

**Inspire:**
- Jackbox-style clarity of whose turn it is (phase banner).
- Team split layouts from competitive party games (columns, not tabs).

**Avoid:**
- Hidden game state (always show phase banner when game active).
- Typing as the primary guess mechanic (spoken guesses only).
- Modal-heavy phase flow (keep play on the video surface).
- Showing suggestions to opposing team (even client-side leak via stream is acceptable per PRD — but UI must not flash).

# IA closure checklist

| Need (PRD) | Surface |
|------------|---------|
| Host starts game | Game panel Setup + control bar |
| Game view | CallStage layout mode |
| Team layouts | CallStage columns |
| Suggestion + vote | Floating tile |
| Pass On | Tile footer / panel |
| Mime word | Mime tile overlay |
| Start act | Panel + banner action |
| Accept/Reject | Panel / banner |
| Ready | Tile chip + panel |
| Shuffle / switch team | Panel (ready_check) |
| Host force/restart/end | Panel host section |
| Room scoreboard | Panel Scoreboard tab |
| Auth only | Login gate + lobby update |

All PRD UX needs have a surface. No orphan screens.
