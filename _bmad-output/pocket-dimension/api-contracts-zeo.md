# API Contracts — zeo

Fuller historical table: `_bmad-output/zeo/planning-artifacts/architecture.md` (guest join is **obsolete** — login required).

## Rooms and call

| Method | Path | Auth | Job |
| --- | --- | --- | --- |
| GET | `/health` | — | `{ status: "ok", app: "zeo" }` |
| GET | `/api/rooms` | Optional | Capacity stats |
| POST | `/api/rooms` | contributor/admin | Create room |
| GET | `/api/rooms/[slug]` | Optional | Metadata |
| PATCH | `/api/rooms/[slug]` | Host | Lock / public |
| POST | `/api/rooms/[slug]/token` | **Login** | Mint LiveKit JWT; waiting-room / capacity / blocks |
| POST | `/api/rooms/[slug]/end` | Host | End room |
| POST | `/api/rooms/[slug]/remove` | Host | Remove + session block |
| POST | `/api/rooms/[slug]/mute` | Host | Server mute |
| GET | `/api/rooms/[slug]/waiting` | Host or self | Waiting list |
| POST | `/api/rooms/[slug]/waiting` | Host | `action=admit\|deny` |
| GET, POST | `/api/rooms/[slug]/chat` | Admitted | Poll / send |
| POST | `/api/rooms/[slug]/screen-share/stop-active` | — | Mute all screen tracks (takeover) |
| POST | `/api/webhooks/livekit` | LiveKit signature | Occupancy + room finished |

## Admin / YouTube

| Method | Path | Auth | Job |
| --- | --- | --- | --- |
| GET, PATCH | `/api/admin/settings` | Admin | Operator limits |
| GET | `/api/admin/rooms` | Admin | Active / scheduled |
| POST | `/api/admin/rooms/[slug]/force-end` | Admin | Force end |
| GET, DELETE | `/api/me/youtube-link` | Login | Link status / revoke |
| GET | `/api/auth/youtube/start` | Login | OAuth start |
| GET | `/api/auth/youtube/callback` | Login | OAuth callback |

## Game (charades shell)

| Method | Path | Auth | Job |
| --- | --- | --- | --- |
| GET | `/api/rooms/[slug]/game` | Member | Snapshot |
| POST | `/api/rooms/[slug]/game` | Host | Start |
| DELETE | `/api/rooms/[slug]/game` | Host | End |
| GET | `/api/rooms/[slug]/game/events` | Member | SSE |
| POST | `/api/rooms/[slug]/game/rounds/ready` | Member | Ready |
| POST | `/api/rooms/[slug]/game/rounds/start` | Host | Start round 1 |

Mid-round word/guess UI is still stubbed.

## Shared listening

| Method | Path | Auth | Job |
| --- | --- | --- | --- |
| GET, POST, DELETE | `/api/rooms/[slug]/listening` | Member / host | Snapshot / start / end |
| GET | `/api/rooms/[slug]/listening/events` | Member | SSE |
| GET | `/api/rooms/[slug]/listening/search` | Member | YouTube search |
| POST, PATCH | `/api/rooms/[slug]/listening/queue` | Member / DJ | Add / reorder |
| POST | `/api/rooms/[slug]/listening/play\|pause\|skip\|previous\|seek\|dj` | DJ | Transport |
| GET | `/api/rooms/[slug]/listening/library/playlists` | Member | Playlists |
| GET | `/api/rooms/[slug]/listening/library/playlists/[id]/items` | Member | Items |
| POST | `/api/internal/listening/bot-token` | `MUSIC_WORKER_SECRET` | Bot JWT |
| POST | `/api/internal/listening/worker-event` | Worker secret | Playback events |
| POST | `/api/internal/listening/media-ready` | Worker secret | URL resolved |
