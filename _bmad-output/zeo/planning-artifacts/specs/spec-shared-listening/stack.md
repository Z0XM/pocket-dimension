# Stack — Shared Listening playback

Mechanism companion for CAP-3…CAP-6. Product intents stay in `SPEC.md`.

## Processes

| Process | Responsibility |
|---------|----------------|
| `apps/zeo` | OAuth, encrypted tokens, listening HTTP/SSE, library proxy, mint human + bot LiveKit tokens, queue authority |
| `music-worker` | Accept play/seek/stop jobs; yt-dlp resolve; ffmpeg decode; `@livekit/rtc-node` publish |
| LiveKit | SFU; carries bot audio + existing A/V |

Max **2** concurrent worker playback jobs (room cap).

## Resolve & publish pipeline

```
videoId + linker credentials
  → yt-dlp (bestaudio) / InnerTube as needed
  → media URL
  → ffmpeg → PCM s16le 48k
  → AudioSource on listening-bot participant
  → LiveKit subscribers
```

Pause: gate/stop frame pump. Seek: restart decode from offset (best-effort). End/error: notify zeo → advance or auto-skip.

## Library data paths

| Surface | Mechanism |
|---------|-----------|
| YT playlists, playlist items, Liked | YouTube Data API v3 + linker OAuth |
| YTM library / ytmsearch | InnerTube using linker session |
| Public/search mix | Data API and/or worker search; badge sources in UI |

## Credentials

- Store refresh tokens encrypted (`youtube_account_links`).
- Worker obtains short-lived access material from zeo (or decrypts via shared secret) — never expose to clients.
- Session field `linker_user_id` is immutable for the session lifetime.

## Spike fallback

If `@livekit/rtc-node` cannot publish audio reliably, trial **ffmpeg → WHIP ingress** into the same bot identity semantics. Prefer not to enable Ingress in production until spike proves need.

## Deploy sketch

- System packages: `yt-dlp`, `ffmpeg` on worker image/host.
- Env: LiveKit URL/keys, DB URL, token encryption key, Google OAuth client, worker↔zeo auth shared secret.
- Dokploy/compose: third service beside zeo app + LiveKit.
