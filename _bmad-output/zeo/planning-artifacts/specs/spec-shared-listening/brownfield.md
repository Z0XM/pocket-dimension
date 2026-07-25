# Brownfield notes — Games and Apps + Shared Listening

## Current baseline

| Area | Today | Target gap |
|------|-------|------------|
| Control bar | “Game mode” (`ControlBar.svelte`) | Rename **Games and Apps**; always visible to all participants |
| Panel | `GamePanel.svelte` tabs Setup \| Scoreboard | Tabs **Apps \| Games \| Scoreboard**; Setup content → Games |
| Game layout | `stageLayoutMode = "game"` on game start | Unchanged for games; Listening must not set this |
| Game SSE | `game-state.ts` + `/api/rooms/[slug]/game/*` | Leave in place; add parallel listening SSE/APIs |
| Stage tiles | `participant` \| `screen-share` (`stage-tiles.ts`) | Add `listening` |
| Screen share audio | Human screen-share tracks | Separate from listening bot audio |
| Scoreboard | `roomScores` in game snapshot | Unchanged; Listening does not write |
| LiveKit tokens | Human participants via `/token` | Also mint bot tokens server-side for worker |
| Ingress | Optional in deploy; unused by calls | Do not require for MVP |

## Touchpoints (expected)

| Concern | Primary files / packages |
|---------|---------------------------|
| Shell rename + tabs | `ControlBar.svelte`, `GamePanel.svelte`, `CallExperience.svelte` |
| Apps catalog + Listening controls | New components under `components/call/` (e.g. `AppsTab.svelte`, listening queue/library panels) |
| Listening tile | `stage-tiles.ts`, `VideoGrid.svelte` / `GridTile.svelte`, new `ListeningTile.svelte` |
| Hide bot from grid | Tile builder / participant enumeration in `CallExperience` / `VideoGrid` |
| Listening state | New `lib/listening/*` (SSE store, types) parallel to `lib/game-state.ts` |
| APIs | `routes/api/rooms/[slug]/listening/**`, `routes/api/me/youtube-link/**`, OAuth callback |
| Schema | `shared/db` zeo schema + migration |
| Worker | New `apps/zeo-music-worker` (or equivalent) + deploy compose/Dokploy service |
| Volume | Extend tile volume keys for listening tile |

## Identity conventions

- Bot LiveKit identity: `listening-bot:{roomId}` (or slug-stable equivalent).
- Filter prefix `listening-bot:` from camera participant tiles everywhere tiles are built.

## Compatibility

- Do not break Charades host/player flows while renaming the panel.
- Keyboard shortcut currently bound to game panel (`G`) should open Games and Apps (same panel).
