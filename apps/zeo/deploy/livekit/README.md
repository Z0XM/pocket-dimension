# LiveKit deployment (zeo)

Self-hosted LiveKit SFU for local development and production.

## Dokploy (recommended)

Production on **Dokploy**: use **[`docker-compose.dokploy.yml`](./docker-compose.dokploy.yml)** and **[`livekit.dokploy.yaml.example`](./livekit.dokploy.yaml.example)** — full steps in **[`../dokploy/README.md`](../dokploy/README.md)**.

**Railpack does not apply to LiveKit** — use Compose with the official `livekit/livekit-server` image and `network_mode: host`.

1. Create a **Compose** project in Dokploy.
2. Paste or mount `docker-compose.dokploy.yml`.
3. Copy `livekit.dokploy.yaml.example` → `livekit.prod.yaml` and set `keys`, `webhook`, and `turn.domain`.
4. Attach Traefik domain **`zeo-livekit.z0xm.com`** → container port **7880**.
5. Cloudflare: **`zeo-livekit` DNS only** (grey cloud).
6. Hostinger firewall: UDP **50000–60000**, **3478**, **5349**.

## Local development

```bash
cd apps/zeo/deploy/livekit
docker compose up -d
```

Set zeo app env (see `apps/zeo/.env.example`):

```env
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
LIVEKIT_URL=ws://127.0.0.1:7880
PUBLIC_LIVEKIT_URL=ws://127.0.0.1:7880
```

Verify LiveKit is listening:

```bash
curl -sI http://127.0.0.1:7880 | head -1
```

## Configuration

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Dev: official image with `--dev` flag |
| `livekit.yaml` | Dev ports, room limits, dev keys, webhook URL |
| `docker-compose.dokploy.yml` | Dokploy Compose (host network) |
| `livekit.dokploy.yaml.example` | Dokploy/production config template |
| `docker-compose.prod.yml.example` | Legacy VPS compose (no `--dev`) |
| `livekit.prod.yaml.example` | Legacy VPS production config |

`livekit.yaml` sets `room.max_participants: 12` at the SFU layer. The zeo app enforces **6 participants per room** and **2 concurrent rooms** in application logic.

## Ports (Hostinger / VPS firewall)

Open these in **ufw** and Hostinger panel (full script: [../firewall/ufw-rules.example.sh](../firewall/ufw-rules.example.sh)):

| Port | Protocol | Service |
|------|----------|---------|
| 443 | TCP | HTTPS (Traefik/Caddy → app + LiveKit WSS) |
| 7880 | TCP | LiveKit signal (dev; production proxied via 443) |
| 7881 | TCP | LiveKit ICE TCP |
| 50000–60000 | UDP | WebRTC media (RTC port range) |
| 3478 | UDP/TCP | TURN (LiveKit embedded or coturn) |
| 5349 | TCP | TURN TLS |
| 49152–65535 | UDP | TURN relay range |

## TURN

### LiveKit embedded TURN (recommended)

Enable in `livekit.prod.yaml.example` / `livekit.dokploy.yaml.example`:

```yaml
turn:
  enabled: true
  domain: zeo-livekit.z0xm.com
  tls_port: 5349
  udp_port: 3478
  external_tls: true
```

Requirements:

- TLS certificate for `zeo-livekit.z0xm.com` (Traefik/Caddy handles this)
- Firewall ports 3478, 5349, 49152–65535 open
- Clients receive TURN credentials automatically via LiveKit signaling

### External coturn (optional)

If embedded TURN is disabled, use [../coturn/](../coturn/) and configure `LIVEKIT_TURN_*` in zeo env.

## Legacy (Caddy + systemd VPS)

If you are **not** using Dokploy, see [`../README.legacy-caddy-systemd.md`](../README.legacy-caddy-systemd.md).

- Copy `livekit.prod.yaml.example` → `livekit.prod.yaml`; generate keys with `livekit-server generate-keys`.
- Set webhook URL to `https://zeo.z0xm.com/api/webhooks/livekit`.
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
