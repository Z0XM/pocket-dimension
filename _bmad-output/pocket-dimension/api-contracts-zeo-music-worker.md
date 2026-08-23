# API Contracts — zeo-music-worker

**Base:** `PORT` default 3010. All job routes require `Authorization: Bearer MUSIC_WORKER_SECRET`.

| Method | Path | Job |
| --- | --- | --- |
| GET | `/health` | Liveness |
| POST | `/jobs/prepare` | Resolve media |
| POST | `/jobs/prefetch` | Prefetch |
| POST | `/jobs/warm` | Warm PCM buffer |
| POST | `/jobs/play` | Play |
| POST | `/jobs/pause` | Pause |
| POST | `/jobs/resume` | Resume |
| POST | `/jobs/seek` | Seek |
| POST | `/jobs/skip` | Skip |
| POST | `/jobs/stop` | Stop |

Outbound to zeo: `POST /api/internal/listening/{bot-token,worker-event,media-ready}`.
