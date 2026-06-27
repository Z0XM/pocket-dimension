# zeo production on Hostinger + Dokploy + Cloudflare

Primary runbook for deploying zeo with **Dokploy** (Traefik TLS), **Cloudflare DNS**, and **LiveKit as a Dokploy Compose** project on Hostinger KVM.

For manual Caddy + systemd deployment, see [../README.legacy-caddy-systemd.md](../README.legacy-caddy-systemd.md).

## Architecture

```
Cloudflare DNS
  zeo.z0xm.com          → proxied → Dokploy Traefik → zeo container (:3008)
  zeo-livekit.z0xm.com  → DNS only → VPS → LiveKit (host network :7880 WSS via Traefik)

Dokploy (Hostinger VPS)
  Application: zeo           (Railpack — same as other Pocket Dimension apps)
  Application: auth-service  (existing — required)
  Compose: livekit           (official Docker image, host network — not Railpack)
  Database: PostgreSQL 18    (Dokploy service or external)
```

## Prerequisites

| Item | Requirement |
|------|-------------|
| Hostinger VPS | KVM 2+ recommended; Docker available for Dokploy |
| Dokploy | Installed on VPS ([dokploy.com](https://dokploy.com)) |
| Cloudflare | DNS for `z0xm.com` — see [cloudflare-dns.md](./cloudflare-dns.md) |
| PostgreSQL **18+** | `uuidv7()` in migrations — use Dokploy Postgres 18 or external |
| Git repo | `Z0XM/pocket-dimension` (or your fork) connected to Dokploy |

## 1. Cloudflare DNS

Configure records per [cloudflare-dns.md](./cloudflare-dns.md):

- `zeo` → A → VPS IP → **Proxied**
- `zeo-livekit` → A → VPS IP → **DNS only** (grey cloud — required for WebRTC)

## 2. Hostinger firewall

Open ports on the VPS (hPanel + ufw). Cloudflare does not proxy UDP WebRTC.

```bash
sudo bash apps/zeo/deploy/firewall/ufw-rules.example.sh
```

Traefik/Dokploy needs **80** and **443** tcp. LiveKit needs **7881** tcp, **50000–60000** udp, TURN ports **3478**, **5349**, **49152–65535** udp.

## 3. PostgreSQL 18

### Option A — Dokploy database service

1. Dokploy → **Databases** → Create → PostgreSQL **18**
2. Note internal hostname (e.g. `zeo-postgres`) and credentials
3. Connection string: `postgresql://USER:PASS@zeo-postgres:5432/postgres`

### Option B — Existing Postgres on VPS

Use the host IP or Docker gateway from other containers.

### Migrations

Run once after Postgres is up:

**Option A — Dokploy Terminal** (zeo app container; `DATABASE_URL` already set):

```bash
cd /app/shared/db && bunx --bun drizzle-kit migrate
```

**Option B — from your machine** (repo cloned, DB reachable):

```bash
DATABASE_URL=postgresql://... bun run db:migrate
```

Grant roles in `auth.users` (`contributor` / `admin`) for room creators.

## 4. auth-service

Deploy `auth-service` as a separate Dokploy **Application** (if not already running).

| Setting | Value |
|---------|-------|
| Domain | `auth.z0xm.com` |
| Port | `5001` |

Required env (must match zeo):

```env
BETTER_AUTH_SECRET=<same secret everywhere>
BETTER_AUTH_URL=https://auth.z0xm.com
BETTER_AUTH_TRUSTED_ORIGINS=https://auth.z0xm.com,https://zeo.z0xm.com
BETTER_AUTH_COOKIE_DOMAIN=.z0xm.com
DATABASE_URL=postgresql://...
RESEND_API_KEY=...
```

## 5. Deploy zeo (Dokploy Application — Railpack)

Use **Railpack** like your other Pocket Dimension apps (`auth-service`, `chhan-chhan`, etc.). No custom Dockerfile required.

### 5.1 Create application

1. Dokploy → **Applications** → **Create**
2. **Source:** Git → `pocket-dimension` repo, branch `main` (or your deploy branch)
3. **Build type:** **Railpack**
4. **Root directory / build context:** `/` (monorepo root)
5. **Port:** `3008`

### 5.2 Railpack commands

Set in Dokploy **Environment** (or copy from `apps/zeo/.env.example`):

```env
RAILPACK_BUILD_CMD=./apps/zeo/scripts/deploy-build.sh
RAILPACK_START_CMD=cd apps/zeo && bun run start
```

The build script installs workspace deps, builds shared packages + zeo, and runs `db:migrate` when `DATABASE_URL` is set at build time.

**Alternative:** Dockerfile at `apps/zeo/Dockerfile` (repo root context) if you prefer a fixed image build.

### 5.3 Domain (Traefik)

1. **Domains** → Add `zeo.z0xm.com`
2. Enable HTTPS (Let's Encrypt via Dokploy Traefik)
3. If Cloudflare is **proxied** on this hostname, set Cloudflare SSL to **Full (strict)**

### 5.4 Environment variables

Set in Dokploy **Environment** tab (see [../env/production.env.example](../env/production.env.example)):

```env
NODE_ENV=production
PORT=3008
ORIGIN=https://zeo.z0xm.com

DATABASE_URL=postgresql://USER:PASS@YOUR_POSTGRES_HOST:5432/postgres

BETTER_AUTH_SECRET=<same as auth-service>
BETTER_AUTH_URL=https://auth.z0xm.com
BETTER_AUTH_PATH=/
BETTER_AUTH_TRUSTED_ORIGINS=https://zeo.z0xm.com,https://auth.z0xm.com
BETTER_AUTH_COOKIE_DOMAIN=.z0xm.com

PUBLIC_BASE_AUTH_URL=https://auth.z0xm.com
PUBLIC_BASE_AUTH_PATH=/

RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@z0xm.com

LIVEKIT_API_KEY=<from livekit-server generate-keys>
LIVEKIT_API_SECRET=<same>
LIVEKIT_URL=https://zeo-livekit.z0xm.com
PUBLIC_LIVEKIT_URL=wss://zeo-livekit.z0xm.com
```

Notes:

- `LIVEKIT_URL` uses **https** — the server SDK converts it for the LiveKit HTTP API. Using the public URL works when zeo and LiveKit are separate Dokploy projects.
- `PUBLIC_LIVEKIT_URL` is what browsers use (`wss://`).
- Do not rely on a `.env` file inside the container; Dokploy injects env at runtime.

### 5.5 Deploy

Click **Deploy**. First build runs `bun install`, builds shared packages, builds zeo, starts `bun ./build/index.js`.

Verify:

```bash
curl -sf https://zeo.z0xm.com/health
# {"status":"ok","app":"zeo"}
```

## 6. Deploy LiveKit (Dokploy Compose — not Railpack)

**LiveKit cannot use Railpack.** It is not Bun/Node source in this repo — it is the upstream [`livekit/livekit-server`](https://hub.docker.com/r/livekit/livekit-server) binary and it needs **host network** for WebRTC UDP ports (50000–60000) and TURN.

Deploy LiveKit as a **Dokploy Compose** project using the official image (no custom Dockerfile):

### 6.1 Prepare config

On the VPS (or in Dokploy Compose file editor), create a project directory with:

1. Copy [../livekit/docker-compose.dokploy.yml](../livekit/docker-compose.dokploy.yml)
2. Copy [../livekit/livekit.dokploy.yaml.example](../livekit/livekit.dokploy.yaml.example) → `livekit.prod.yaml`
3. Generate keys:

   ```bash
   docker run --rm livekit/livekit-server:v1.9.4 livekit-server generate-keys
   ```

4. Paste keys into `livekit.prod.yaml` `keys:` and `webhook.api_key`
5. Set `turn.domain` to `zeo-livekit.z0xm.com`
6. Set webhook URL to `https://zeo.z0xm.com/api/webhooks/livekit`

### 6.2 Create Compose project in Dokploy

1. Dokploy → **Compose** → **Create**
2. Paste `docker-compose.dokploy.yml` content
3. Upload or mount `livekit.prod.yaml` beside the compose file
4. **Enable host network** if Dokploy exposes the option (required for UDP 50000–60000)
5. Deploy the stack

LiveKit listens on host **7880** (signal), **7881** (ICE TCP), UDP media range, TURN ports.

### 6.3 Domain for LiveKit WSS

1. In the Compose service settings, add domain **`zeo-livekit.z0xm.com`**
2. Map to container/host port **7880**
3. Enable **HTTPS** + **WebSocket** support in Dokploy
4. Confirm Cloudflare record is **DNS only** (grey cloud)

Verify WebSocket upgrade:

```bash
curl -sI \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  https://zeo-livekit.z0xm.com | head -5
```

Expect `101 Switching Protocols` when LiveKit is running.

### 6.4 Sync keys to zeo

Ensure zeo env `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` match `livekit.prod.yaml`. Redeploy zeo after changing keys.

## 7. Post-deploy checklist

| Step | Command / action |
|------|------------------|
| App health | `curl https://zeo.z0xm.com/health` |
| LiveKit WSS | WebSocket check above |
| Webhook route | `curl -sI -X POST https://zeo.z0xm.com/api/webhooks/livekit` → 401 (route exists) |
| Login | Sign up / login at https://zeo.z0xm.com |
| Create room | User with `contributor` or `admin` role |
| Call test | Two browsers + guest join |
| Mobile / TURN | Join from cellular network |
| Admin | Promote user to `admin`, open `/admin` |

## 8. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Calls connect but no video | Cloudflare proxy on `zeo-livekit`? Must be **grey cloud**. UDP 50000–60000 open on Hostinger? |
| WebSocket failed | Dokploy domain on LiveKit port 7880; Traefik WebSocket enabled |
| Webhook / wrong participant count | Keys match between `livekit.prod.yaml` and zeo env; webhook URL is public HTTPS |
| Auth redirect loop | `BETTER_AUTH_TRUSTED_ORIGINS`, `BETTER_AUTH_COOKIE_DOMAIN=.z0xm.com`, HTTPS on `ORIGIN` |
| Build fails | Railpack: root = repo root, `RAILPACK_BUILD_CMD=./apps/zeo/scripts/deploy-build.sh`; check build logs |
| `uuidv7()` migration error | PostgreSQL must be **18+** |
| zeo can't reach LiveKit API | Set `LIVEKIT_URL=https://zeo-livekit.z0xm.com` (public URL) |

## 9. File index

| File | Purpose |
|------|---------|
| [../../scripts/deploy-build.sh](../../scripts/deploy-build.sh) | Railpack build script |
| [../../Dockerfile](../../Dockerfile) | Optional zeo Dockerfile (Railpack alternative) |
| [cloudflare-dns.md](./cloudflare-dns.md) | DNS proxy rules |
| [../livekit/docker-compose.dokploy.yml](../livekit/docker-compose.dokploy.yml) | LiveKit Compose for Dokploy |
| [../livekit/livekit.dokploy.yaml.example](../livekit/livekit.dokploy.yaml.example) | LiveKit config template |
| [../env/production.env.example](../env/production.env.example) | Env reference |
| [../firewall/ufw-rules.example.sh](../firewall/ufw-rules.example.sh) | VPS firewall ports |
