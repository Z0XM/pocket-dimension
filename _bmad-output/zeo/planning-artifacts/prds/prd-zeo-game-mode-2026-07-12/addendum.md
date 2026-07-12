# zeo Game Mode PRD — Addendum

Technical and implementation context supporting the game mode PRD. Requirements narrative lives in `prd.md`.

## Relationship to original PRD

- Base PRD: `prd-zeo-2026-06-27/prd.md` (Phase 1–3 video calling)
- This addendum: **Phase 4 — Game Mode** + **guest removal**
- On conflict, this document and `prd.md` (game mode) take precedence for join/auth and in-call game features

## Stack decisions (game mode)

| Layer | Choice | Notes |
|-------|--------|-------|
| Game state | PostgreSQL `zeo` schema | Server-authoritative; survives reconnect |
| Push to clients | **SSE** (`GET /api/rooms/[slug]/game/events`) | One stream per connected participant during active game |
| Mutations | HTTP POST (`/api/rooms/[slug]/game/*`) | Vote, pass-on, accept/reject, ready, host actions |
| Ephemeral signals (optional) | LiveKit data channel | Cosmetic only; not source of truth |
| Client orchestration | `CallExperience.svelte` | SSE subscription; `stageLayoutMode: "game"` |
| Layout | Extend `stage-grid.ts`, `auto-layout.ts` or dedicated `game-layout.ts` | Team columns / rows per FR-GM-10 |

## Proposed schema (zeo)

```
game_sessions       — room_id, host_user_id, game_type, status, current_phase, config jsonb
game_teams          — session_id, name, color, sort_order
game_participants   — session_id, user_id, team_id, is_ready
game_rounds         — session_id, round_number, proposing_team_id, guessing_team_id,
                      mime_user_id, locked_word, phase, status
game_suggestions    — round_id, suggester_user_id, word, created_at
game_suggestion_votes — suggestion_id, voter_user_id (unique per suggestion)
room_scores         — room_id, user_id, total_score, games_played (persists across games)
game_chat_messages  — session_id, team_id nullable, content (cascade delete on session end)
```

Charades round `phase` enum (suggested): `submission | passed_on | act | verdict | ready_check | completed`

## SSE snapshot shape (minimum)

```json
{
  "session": { "id", "gameType", "status", "currentPhase" },
  "round": { "id", "number", "phase", "proposingTeamId", "guessingTeamId", "mimeUserId", "lockedWord" },
  "teams": [{ "id", "name", "color", "memberUserIds", "score" }],
  "participants": [{ "userId", "teamId", "isReady", "displayName" }],
  "suggestions": [{ "id", "word", "voteCount", "voterUserIds" }],
  "roomScoreboard": [{ "userId", "displayName", "totalScore" }]
}
```

`lockedWord` included in payload for all clients; **client hides** from non-mime / non-proposing-team per Charades rules. Server does not filter per-role in MVP.

## Accept/Reject concurrency pattern

```sql
BEGIN;
  SELECT phase FROM game_rounds WHERE id = $round_id FOR UPDATE;
  -- if phase != 'verdict', return 409
  UPDATE game_rounds
  SET phase = 'ready_check', verdict = $accept_or_reject, resolved_by = $user_id
  WHERE id = $round_id AND phase = 'verdict'
  RETURNING id;
  -- empty RETURNING → 409 already_judged
COMMIT;
-- broadcast SSE snapshot
```

## Guest removal touchpoints

| Area | File / endpoint | Change |
|------|-----------------|--------|
| Token mint | `apps/zeo/src/routes/api/rooms/[slug]/token/+server.ts` | Require session; remove `guestName` body |
| Lobby | `PreCallLobby.svelte` | Remove guest name path; redirect unauthenticated to login |
| Identity | `identity.ts`, `CallExperience.svelte` | Drop `guestIdentity` branches |
| Chat | `chat.ts`, `ChatPanel.svelte` | User id only |
| Tiles | `ParticipantTile.svelte` | Remove guest badge |
| Validation | `validation/rooms.ts` | Remove guest token schema fields |
| PRD refs | Original FR-1, FR-5, FR-40 | Mark superseded |

## Shuffle algorithm (min 2 per team)

1. Collect all `game_participants` for session.
2. Fisher-Yates shuffle member list.
3. Distribute round-robin into N teams.
4. If any team has fewer than 2 members, move members from largest team until all teams ≥ 2 or return 422 if impossible (e.g. 3 players, 2 teams).

## Extension points for future games

- `game_sessions.game_type` enum: `charades` first; future values add layout + tile + chat rules
- `game_sessions.config` jsonb: per-game settings (team count, timers when added)
- Floating tile registry: game module registers tile components + visibility predicate
- Team layout engine: parameterized by team count per FR-GM-10

## Deferred (explicit TODO)

- Phase timers (think time, act time)
- Opponent sub-team chat (platform hook FR-GM-18; not Charades)
- Host migration when host disconnects mid-game
- Server-side filtered payloads for suggestion tile (if cheating becomes a concern)
