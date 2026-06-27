# LiveKit (Zeo)

Production on **Dokploy**: use **[`docker-compose.dokploy.yml`](./docker-compose.dokploy.yml)** and **[`livekit.dokploy.yaml.example`](./livekit.dokploy.yaml.example)** — full steps in **[`../dokploy/README.md`](../dokploy/README.md)**.

## Dokploy (recommended)

1. Create a **Compose** project in Dokploy.
2. Paste or mount `docker-compose.dokploy.yml`.
3. Copy `livekit.dokploy.yaml.example` → `livekit.yaml` and set `keys`, `webhook`, and `turn.domain`.
4. Attach Traefik domain **`zeo-livekit.z0xm.com`** → container port **7880**.
5. Cloudflare: **`zeo-livekit` DNS only** (grey cloud).
6. Hostinger firewall: UDP **50000–60000**, **3478**, **5349**.

## Local development

```bash
cd apps/zeo/deploy/livekit
docker compose up -d
```

Uses `docker-compose.yml` + `livekit.yaml.example` on `127.0.0.1:7880`.

## Legacy (Caddy + systemd VPS)

If you are **not** using Dokploy, see [`../README.legacy-caddy-systemd.md`](../README.legacy-caddy-systemd.md) and the original `docker-compose.yml` with manual Caddy TLS on the VPS.
