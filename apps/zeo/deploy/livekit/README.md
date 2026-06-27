# LiveKit deployment (zeo)

Self-hosted LiveKit SFU for local development and Hostinger VPS production.

## Quick start (local dev)

1. From this directory:

   ```bash
   docker compose up -d
   ```

2. Set zeo app env (see `apps/zeo/.env.example`):

   ```env
   LIVEKIT_API_KEY=devkey
   LIVEKIT_API_SECRET=secret
   LIVEKIT_URL=ws://127.0.0.1:7880
   PUBLIC_LIVEKIT_URL=ws://127.0.0.1:7880
   ```

3. Start zeo on port 3008 — webhooks POST to `http://localhost:3008/api/webhooks/livekit`.

4. Verify LiveKit is listening:

   ```bash
   curl -sI http://127.0.0.1:7880 | head -1
   ```

## Configuration

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Official `livekit/livekit-server` image |
| `livekit.yaml` | Ports, room limits, dev keys, webhook URL |

`livekit.yaml` sets `room.max_participants: 12` at the SFU layer. The zeo app enforces **6 participants per room** and **2 concurrent rooms** in application logic.

## Ports (Hostinger / VPS firewall)

Open these in **ufw** and Hostinger panel:

| Port | Protocol | Service |
|------|----------|---------|
| 443 | TCP | HTTPS (Caddy → app + LiveKit WSS) |
| 7880 | TCP | LiveKit signal (dev; production usually proxied via 443) |
| 7881 | TCP | LiveKit ICE TCP |
| 50000–60000 | UDP | WebRTC media (RTC port range) |
| 3478 | UDP/TCP | TURN (if using coturn) |
| 5349 | TCP | TURN TLS |
| 49152–65535 | UDP | TURN relay range (coturn) |

## Production notes

- Replace dev keys in `livekit.yaml` with secrets from env / secrets manager.
- Set webhook URL to `https://zeo.z0xm.com/api/webhooks/livekit`.
- Set `PUBLIC_LIVEKIT_URL=wss://zeo-livekit.z0xm.com` in the zeo app.
- Use Caddy (Epic 6) to terminate TLS for app and LiveKit subdomains.

## Connect from zeo app

After Epic 3 room creation, mint a token:

```bash
curl -X POST http://localhost:3008/api/rooms/{slug}/token \
  -H "Cookie: <session-cookie>" \
  -H "Content-Type: application/json"
```

Response: `{ "token": "...", "wsUrl": "ws://127.0.0.1:7880" }`

Use `livekit-client` in the browser with that token (Epic 4).
