# zeo production deployment (legacy: Caddy + systemd)

Manual VPS runbook without Dokploy. For **Hostinger + Dokploy + Cloudflare**, use **[dokploy/README.md](./dokploy/README.md)** instead.

## Topology

```
Internet
   │
   ▼
Caddy (:443)
   ├── zeo.z0xm.com          → zeo app (localhost:3008)
   └── zeo-livekit.z0xm.com  → LiveKit signal (localhost:7880)

LiveKit (host network) — WebRTC UDP 50000–60000, ICE TCP 7881, embedded TURN 3478/5349
PostgreSQL 18 (host)
auth-service (localhost:5001, proxied separately at auth.z0xm.com)
```

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Hostinger KVM 2 | 2 vCPU, 8 GB RAM recommended |
| Ubuntu 22.04+ | Root/sudo access |
| Domain DNS | `zeo.z0xm.com`, `zeo-livekit.z0xm.com` → VPS IP |
| PostgreSQL 18 | Required for `uuidv7()` in Drizzle migrations |
| Bun | For building and running zeo + auth-service |
| Docker | For LiveKit server container |

## 1. Firewall

Open ports in **both** Hostinger hPanel firewall and **ufw**:

| Port | Protocol | Service |
|------|----------|---------|
| 22 | TCP | SSH |
| 80 | TCP | Caddy ACME |
| 443 | TCP | HTTPS (app + LiveKit WSS) |
| 7881 | TCP | LiveKit ICE TCP |
| 50000–60000 | UDP | WebRTC media |
| 3478 | UDP/TCP | TURN |
| 5349 | TCP | TURN TLS |
| 49152–65535 | UDP | TURN relay |

```bash
sudo bash apps/zeo/deploy/firewall/ufw-rules.example.sh
```

See also [firewall/ufw-rules.example.sh](./firewall/ufw-rules.example.sh).

## 2. Database

```bash
sudo pg_ctlcluster 18 main start   # if not running
cd /opt/pocket-dimension
cp shared/db/.env.example shared/db/.env   # set DATABASE_URL
bun run db:migrate
```

Grant contributor/admin roles in `auth.users` for room creators.

## 3. auth-service

Copy and edit env (see [env/production.env.example](./env/production.env.example) auth section):

```bash
# /etc/auth-service/env — BETTER_AUTH_SECRET, DATABASE_URL, RESEND_API_KEY, etc.
cd /opt/pocket-dimension
bun run build
bun run build:app:auth   # if separate
# systemd unit for auth-service (same pattern as zeo.service.example)
```

Ensure `BETTER_AUTH_TRUSTED_ORIGINS` includes `https://zeo.z0xm.com`.

## 4. LiveKit

```bash
cd /opt/pocket-dimension/apps/zeo/deploy/livekit
cp livekit.prod.yaml.example livekit.prod.yaml
cp docker-compose.prod.yml.example docker-compose.prod.yml

# Generate production keys
docker run --rm livekit/livekit-server:v1.9.4 livekit-server generate-keys
# Paste into livekit.prod.yaml keys: section AND /etc/zeo/env

docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml logs -f
```

Verify signal port:

```bash
curl -sI http://127.0.0.1:7880 | head -1
```

### TURN

**Recommended:** LiveKit embedded TURN (`turn.enabled: true` in `livekit.prod.yaml.example`).

Clients receive ephemeral TURN credentials automatically during the WebSocket join handshake — no extra client config required.

**Alternative:** coturn sidecar — see [coturn/](./coturn/) and set `LIVEKIT_TURN_*` in zeo env.

## 5. Caddy (HTTPS)

```bash
cd /opt/pocket-dimension/apps/zeo/deploy/caddy
sudo cp Caddyfile.example /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
```

Let's Encrypt certificates are issued automatically. Details: [caddy/README.md](./caddy/README.md).

## 6. zeo app

```bash
cd /opt/pocket-dimension
bun install --frozen-lockfile
bun run build          # shared packages
bun run build:app:zeo

sudo cp apps/zeo/deploy/env/production.env.example /etc/zeo/env
# Edit /etc/zeo/env — ORIGIN, LIVEKIT keys, DATABASE_URL, BETTER_AUTH_*

sudo cp apps/zeo/deploy/systemd/zeo.service.example /etc/systemd/system/zeo.service
sudo useradd --system --home /opt/pocket-dimension/apps/zeo zeo || true
sudo chown -R zeo:zeo /opt/pocket-dimension/apps/zeo

sudo systemctl daemon-reload
sudo systemctl enable --now zeo
```

## 7. Start / stop / logs

| Service | Start | Stop | Logs |
|---------|-------|------|------|
| zeo | `sudo systemctl start zeo` | `sudo systemctl stop zeo` | `journalctl -u zeo -f` |
| LiveKit | `docker compose -f docker-compose.prod.yml up -d` | `docker compose -f docker-compose.prod.yml down` | `docker compose -f docker-compose.prod.yml logs -f` |
| Caddy | `sudo systemctl start caddy` | `sudo systemctl stop caddy` | `journalctl -u caddy -f` |
| PostgreSQL | `sudo systemctl start postgresql` | `sudo systemctl stop postgresql` | `journalctl -u postgresql -f` |

## 8. Post-deploy health checks

Run in order after all services are up:

```bash
# 1. App health
curl -sf https://zeo.z0xm.com/health | jq .
# Expected: {"status":"ok","app":"zeo"}

# 2. LiveKit WSS reachable (via Caddy)
curl -sI https://zeo-livekit.z0xm.com | head -3

# 3. Webhook path (expect 401 without LiveKit signature — proves route exists)
curl -sI -X POST https://zeo.z0xm.com/api/webhooks/livekit | head -1

# 4. Auth service reachable from browser — sign up / login at https://zeo.z0xm.com

# 5. End-to-end call test
#    - Contributor creates room at https://zeo.z0xm.com
#    - Second browser joins /room/{slug} as guest
#    - Verify video + screen share
#    - Test from mobile network (validates TURN)
```

## 9. Troubleshooting

| Symptom | Check |
|---------|-------|
| No video / stuck connecting | UDP 50000–60000 open? TURN ports open? `PUBLIC_LIVEKIT_URL=wss://...` |
| WebSocket failed | Caddy running? LiveKit on 7880? DNS for zeo-livekit |
| Auth redirect loop | `BETTER_AUTH_TRUSTED_ORIGINS`, cookie domain, HTTPS on ORIGIN |
| Webhook not firing | `livekit.prod.yaml` webhook URL uses https://zeo.z0xm.com |
| Room count wrong | Webhook auth keys match zeo env LIVEKIT_API_* |
