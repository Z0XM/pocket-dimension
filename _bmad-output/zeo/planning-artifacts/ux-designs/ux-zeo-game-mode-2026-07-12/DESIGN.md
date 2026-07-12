---
title: zeo Game Mode UX Design
status: final
created: 2026-07-12
updated: 2026-07-12
extends:
  - /workspace/apps/zeo/DESIGN.md
  - /workspace/_bmad-output/zeo/planning-artifacts/ux-designs/ux-zeo-2026-06-27/DESIGN.md
sources:
  - /workspace/_bmad-output/zeo/planning-artifacts/prds/prd-zeo-game-mode-2026-07-12/prd.md
colors:
  gameAccent: "#8b5cf6"
  teamBorderWidth: "2px"
  phaseBanner: "#141418"
  floatingTile: "#141418"
  scoreHighlight: "#f5f5f0"
  voteLeader: "#8b5cf6"
typography:
  phaseLabel: "text-sm font-medium uppercase tracking-wide"
  teamHeader: "text-sm font-semibold"
  suggestionWord: "text-base font-medium"
rounded:
  floatingTile: "{rounded.lg}"
  phaseBanner: "{rounded.md}"
spacing:
  gameColumnGap: 12
  floatingTilePadding: 16
components:
  gamePanel: "bg-card/95 backdrop-blur-sm border border-border rounded-xl"
  floatingSuggestionTile: "bg-card/95 backdrop-blur-md border border-border shadow-lg"
  phaseBanner: "bg-card/90 backdrop-blur-sm border border-border"
  gameControlButton: "shadcn Button default variant"
  hostSecondaryButton: "shadcn Button outline variant, text-muted-foreground"
---

# Brand & Style

Game mode inherits zeo's dark, calm studio aesthetic from `apps/zeo/DESIGN.md`. The video grid remains the hero; game chrome stays quieter than participant faces. Game mode adds **structure through layout and phase affordances**, not new decorative color.

The layout transform when a game starts should feel like the room **becomes a stage** — two columns for Charades, team labels and scores as ambient context, phase banner as the only persistent game chrome on the stage itself.

## Colors

- **Game accent** (`gameAccent`): `{colors.gameAccent}` — phase banner accent stripe, vote leader highlight, active game control on control bar. Same violet as links/live states; do not introduce a second accent.
- **Team border** (`teamBorderWidth` + participant color): each tile keeps its existing participant color ring; team grouping adds a subtle column header tint using team members' shared visual cluster (first member's color as team dot).
- **Phase banner** (`phaseBanner`): `{colors.phaseBanner}` with `{colors.foreground}` text — top-center during play.
- **Floating tile** (`floatingTile`): `{colors.floatingTile}` — suggestion tile; slightly elevated over video.
- **Vote leader** (`voteLeader`): `{colors.voteLeader}` left border or badge on highest-voted suggestion.
- **Score highlight** (`scoreHighlight`): brief pulse on team score increment using `{colors.scoreHighlight}` at 80% opacity.

## Typography

- Phase labels: `{typography.phaseLabel}` — e.g. "Team A is choosing a word"
- Team headers: `{typography.teamHeader}` — "Team A · 3 pts"
- Suggestion words: `{typography.suggestionWord}` in floating tile list
- Scores in scoreboard tab: mono tabular nums (`font-variant-numeric: tabular-nums`)

## Layout & Spacing

- **Game view** fills viewport above control bar reserve (same `controlBarReservePx` pattern as chat/grid panels).
- **Two-team Charades:** 50/50 split with `{spacing.gameColumnGap}` gutter; team header strip 32px tall above tile stack.
- **Three-team:** single top row, three equal columns.
- **Four-team:** top row three columns + bottom row one centered column (team 4), max 50% viewport height for bottom band.
- **Floating suggestion tile:** `{spacing.floatingTilePadding}` internal padding; default position inset 16px from bottom-right above control bar reserve; min-width 280px, max-width 360px desktop.
- **Game panel:** width 320px desktop; full-width bottom sheet on mobile (`≤640px`), max-height 70vh.

## Elevation & Depth

- Floating suggestion tile: `shadow-lg`, `z-index` above video tiles (`z-40`), below modals (`z-50`).
- Phase banner: `z-30`, does not capture pointer events except optional dismiss on late-join overlay.
- Game panel: `z-30`, matches `ChatPanel` / `GridSettingsPanel`.

## Shapes

- Game panel: `{components.gamePanel}` — matches existing panel vocabulary.
- Floating tile: `{rounded.floatingTile}`.
- Phase banner: `{rounded.phaseBanner}`, pill shape on mobile.
- Team column: no outer border; divider line `{colors.border}` 1px vertical between teams (desktop two-column).

## Components

### Game Mode control bar button
- Icon: `gamepad-2` (Lucide) or `dice-5` — pick one in implementation; consistent size with grid/chat buttons.
- **Host:** always visible; `aria-label="Game mode"`.
- **Non-host during active game:** visible (opens read-only game panel / scoreboard).
- **Active game:** button uses `{colors.gameAccent}` ring or `aria-pressed="true"`.
- **Mobile:** when game active, promote from overflow menu to primary bar (FR NFR-GM-6).

### Game settings panel
- Tabs: **Setup** | **Scoreboard** (Setup host-only until game ends; players see Scoreboard + read-only status).
- Setup tab: game type select, team count pills (2–4; Charades locks 2), **Start game** primary button.
- In-game host section: **Force next round**, **Restart round** (outline), **End game** (destructive, confirm).
- Between rounds: **Shuffle teams** button (outline, full width).

### Phase banner
- Top-center, non-interactive except late-join dismiss.
- Copy templates per phase (see EXPERIENCE.md).
- Optional thin `{colors.gameAccent}` bottom border.

### Floating suggestion tile (Charades)
- Header: drag handle + title "Suggestions" + overflow menu (Reset position).
- Body: scrollable suggestion list.
- Row: word + vote count badge; leader row has `{colors.voteLeader}` left accent.
- Footer: text input + **Submit** button.
- **Pass On** appears in game panel or tile footer when ≥1 vote exists (host-visible to proposing team only).

### Mime word card
- Not a floating tile — **overlay on mime's own participant tile** only (client-side).
- Large word text centered on tile with semi-transparent `{colors.card}` scrim.
- Other participants do not see this overlay.

### Ready chip
- On participant's own tile corner or below phase banner: **Ready** toggle button.
- Filled `{colors.primary}` when self ready; outline when not.
- Banner shows "3 of 6 ready" during `ready_check`.

### Accept / Reject bar
- Appears for proposing team during `act` phase after mime is acting (or always during act — keep visible).
- Two buttons side by side: **Accept** (primary), **Reject** (outline).
- On 409: toast "Someone else already decided" — no error modal.

### Scoreboard tab
- Table: Player | Team dot | Game pts | Room total.
- Room total column persists across games.
- Empty state: "No games played yet"

### Auth gate (guest removal)
- Lobby card: remove display-name-only path.
- Unauthenticated `/room/[slug]`: centered card — "Sign in to join" primary + "Create account" secondary.

## Do's and Don'ts

### Do
- Animate layout change once on game start (200ms opacity + column slide).
- Keep Accept/Reject large enough for quick taps during excited play.
- Show team scores in column headers during Charades.
- Use `aria-live="polite"` for phase changes and score updates.

### Do not
- Show suggestion tile to guessing team (client hide).
- Use modal dialogs for phase transitions.
- Block the mime's face with large centered game tiles (Charades has none).
- Auto-shuffle without explicit button press.
- Allow team switch UI during submission or act phases.
