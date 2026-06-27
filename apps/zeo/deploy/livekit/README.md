# LiveKit deployment (zeo)

Self-hosted LiveKit SFU for local development and Hostinger VPS production.

**Production runbook:** see [../README.md](../README.md).

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
| `docker-compose.yml` | Dev: official image with `--dev` flag |
| `livekit.yaml` | Dev ports, room limits, dev keys, webhook URL |
| `docker-compose.prod.yml.example` | Production compose (no `--dev`) |
| `livekit.prod.yaml.example` | Production ports, embedded TURN, prod webhook |

`livekit.yaml` sets `room.max_participants: 12` at the SFU layer. The zeo app enforces **6 participants per room** and **2 concurrent rooms** in application logic.

## Ports (Hostinger / VPS firewall)

Open these in **ufw** and Hostinger panel (full script: [../firewall/ufw-rules.example.sh](../firewall/ufw-rules.example.sh)):

| Port | Protocol | Service |
|------|----------|---------|
| 443 | TCP | HTTPS (Caddy → app + LiveKit WSS) |
| 7880 | TCP | LiveKit signal (dev; production proxied via 443) |
| 7881 | TCP | LiveKit ICE TCP |
| 50000–60000 | UDP | WebRTC media (RTC port range) |
| 3478 | UDP/TCP | TURN (LiveKit embedded or coturn) |
| 5349 | TCP | TURN TLS |
| 49152–65535 | UDP | TURN relay range |

## TURN

### LiveKit embedded TURN (recommended)

Enable in `livekit.prod.yaml.example`:

```yaml
turn:
  enabled: true
  domain: zeo-livekit.z0xm.com
  tls_port: 5349
  udp_port: 3478
  external_tls: true
```

Requirements:

- TLS certificate for `zeo-livekit.z0xm.com` (Caddy handles this)
- Firewall ports 3478, 5349, 49152–65535 open
- Clients receive TURN credentials automatically via LiveKit signaling

### External coturn (optional)

If embedded TURN is disabled, use [../coturn/](../coturn/) and configure `LIVEKIT_TURN_*` in zeo env. The token API returns explicit `iceServers` for the client.

## Production notes

- Copy `livekit.prod.yaml.example` → `livekit.prod.yaml`; generate keys with `livekit-server generate-keys`.
- Set webhook URL to `https://zeo.z0xm.com/api/webhooks/livekit`.
- Set `PUBLIC_LIVEKIT_URL=wss://zeo-livekit.z0xm.com` in the zeo app.
- Use Caddy ([../caddy/](../caddy/)) to terminate TLS for app and LiveKit subdomains.

## Connect from zeo app

After room creation, mint a token:

```bash
curl -X POST http://localhost:3008/api/rooms/{slug}/token \
  -H "Cookie: <session-cookie>" \
  -H "Content-Type: application/json"
```

Response: `{ "token": "...", "wsUrl": "wss://zeo-livekit.z0xm.com", "iceServers": [...] }`

Use `livekit-client` in the browser with that token.
