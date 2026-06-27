# LiveKit deployment (zeo)

Self-hosted LiveKit SFU for local development and production.

## Dokploy (recommended)

Use the official **[Dokploy LiveKit template](https://docs.dokploy.com/docs/templates/livekit)** — full zeo integration steps in **[`../dokploy/README.md`](../dokploy/README.md)**.

Quick summary:

1. Dokploy → **Templates** → **LiveKit** → Deploy
2. Set main domain **`zeo-livekit.z0xm.com`**, turn domain **`zeo-livekit-turn.z0xm.com`**
3. Copy template **`API_KEY`** / **`API_SECRET`** into zeo env
4. Edit template **`livekit.yaml`** — append [dokploy-template-overlay.yaml.example](./dokploy-template-overlay.yaml.example) (webhook + room limits)
5. Cloudflare: both LiveKit subdomains **DNS only** (grey cloud)

**Railpack does not apply to LiveKit.** The Dokploy template deploys the official `livekit/livekit-server` image with Redis.

### Alternative: custom compose

If you are not using the Dokploy template, see [`docker-compose.dokploy.yml`](./docker-compose.dokploy.yml) and [`livekit.dokploy.yaml.example`](./livekit.dokploy.yaml.example) (host network, port range 50000–60000).

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
| `dokploy-template-overlay.yaml.example` | Webhook + room limits for Dokploy template |
| `docker-compose.dokploy.yml` | Alternative custom Dokploy compose (host network) |
| `livekit.dokploy.yaml.example` | Alternative custom production config |
| `docker-compose.prod.yml.example` | Legacy VPS compose (no `--dev`) |
| `livekit.prod.yaml.example` | Legacy VPS production config |

`room.max_participants: 12` at the SFU layer. The zeo app enforces **6 participants per room** and **2 concurrent rooms** in application logic.

## Ports

### Dokploy template (default)

| Port | Protocol | Service |
|------|----------|---------|
| 443 | TCP | HTTPS (Traefik → WSS + TURN TLS) |
| 7880 | TCP | LiveKit signal (internal; proxied via 443) |
| 7881 | TCP | LiveKit ICE TCP |
| 7882 | UDP | WebRTC media (template UDPMux) |
| 3478 | UDP/TCP | TURN UDP |
| 5349 | TCP | TURN TLS |

### Legacy / custom compose (port range)

| Port | Protocol | Service |
|------|----------|---------|
| 50000–60000 | UDP | WebRTC media |
| 49152–65535 | UDP | TURN relay |

Full firewall script: [../firewall/ufw-rules.example.sh](../firewall/ufw-rules.example.sh)

## TURN

The Dokploy template enables embedded TURN with `turn.domain` on the **turn subdomain** (`zeo-livekit-turn.z0xm.com`). Clients receive TURN credentials automatically during the WebSocket join — no extra zeo env needed.

## Legacy (Caddy + systemd VPS)

See [`../README.legacy-caddy-systemd.md`](../README.legacy-caddy-systemd.md).

## Connect from zeo app

After room creation, mint a token:

```bash
curl -X POST http://localhost:3008/api/rooms/{slug}/token \
  -H "Cookie: <session-cookie>" \
  -H "Content-Type: application/json"
```

Response: `{ "token": "...", "wsUrl": "wss://zeo-livekit.z0xm.com", "iceServers": [...] }`
