# zeo production deployment

## Dokploy (recommended)

**Hostinger VPS + Dokploy + Cloudflare + LiveKit on Dokploy:**

→ **[dokploy/README.md](./dokploy/README.md)** — full step-by-step runbook

Quick index:

| Step | Doc section |
|------|-------------|
| Cloudflare DNS (`zeo` proxied, `zeo-livekit` grey cloud) | [dokploy/cloudflare-dns.md](./dokploy/cloudflare-dns.md) |
| VPS firewall (UDP WebRTC + TURN) | [firewall/ufw-rules.example.sh](./firewall/ufw-rules.example.sh) |
| PostgreSQL 18 + migrations | [dokploy/README.md §3](./dokploy/README.md#3-postgresql-18) |
| auth-service on Dokploy | [dokploy/README.md §4](./dokploy/README.md#4-auth-service) |
| zeo app (Railpack) | [dokploy/README.md §5](./dokploy/README.md#5-deploy-zeo-dokploy-application--railpack) |
| LiveKit Compose (host network) | [dokploy/README.md §6](./dokploy/README.md#6-deploy-livekit-dokploy-compose) |
| Environment variables | [env/production.env.example](./env/production.env.example) |

Build the image locally (optional):

```bash
docker build -f apps/zeo/Dockerfile -t zeo .
```

## Legacy (Caddy + systemd)

Bare-metal VPS without Dokploy: **[README.legacy-caddy-systemd.md](./README.legacy-caddy-systemd.md)**

## Directory index

| Path | Purpose |
|------|---------|
| [dokploy/](./dokploy/) | **Primary** Dokploy + Traefik + Cloudflare runbook |
| [livekit/](./livekit/) | Dev compose + Dokploy/production LiveKit configs |
| [env/](./env/) | Production env template |
| [firewall/](./firewall/) | ufw / Hostinger port checklist |
| [caddy/](./caddy/) | Legacy Caddy TLS (non-Dokploy) |
| [systemd/](./systemd/) | Legacy zeo systemd unit |
| [coturn/](./coturn/) | Optional external TURN |
