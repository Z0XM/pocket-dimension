# zeo production on Hostinger + Dokploy + Cloudflare

Primary runbook for deploying zeo with **Dokploy** (Traefik TLS), **Cloudflare DNS**, and the **[Dokploy LiveKit template](https://docs.dokploy.com/docs/templates/livekit)**.

For manual Caddy + systemd deployment, see [../README.legacy-caddy-systemd.md](../README.legacy-caddy-systemd.md).

## Architecture

```
Cloudflare DNS
  zeo.z0xm.com              → proxied → Dokploy Traefik → zeo Railpack app (:3008)
  zeo-livekit.z0xm.com      → DNS only → Traefik → LiveKit signal (:7880 WSS)
  zeo-livekit-turn.z0xm.com → DNS only → Traefik → LiveKit TURN TLS (:5349)

Dokploy (Hostinger VPS)
  Application: zeo           (Railpack)
  Application: auth-service  (existing — required)
  Template: LiveKit          (livekit + redis; egress/ingress optional)
  Database: PostgreSQL 18
```

## Prerequisites

| Item | Requirement |
|------|-------------|
| Hostinger VPS | KVM 2+ recommended |
| Dokploy | Installed on VPS ([dokploy.com](https://docs.dokploy.com)) |
| Cloudflare | DNS for `z0xm.com` — see [cloudflare-dns.md](./cloudflare-dns.md) |
| PostgreSQL **18+** | `uuidv7()` in migrations |
| Git repo | `Z0XM/pocket-dimension` connected to Dokploy |

## 1. Cloudflare DNS

Configure records per [cloudflare-dns.md](./cloudflare-dns.md):

- `zeo` → **Proxied**
- `zeo-livekit` → **DNS only** (grey cloud)
- `zeo-livekit-turn` → **DNS only** (grey cloud)

## 2. Hostinger firewall

```bash
sudo bash apps/zeo/deploy/firewall/ufw-rules.example.sh
```

The Dokploy LiveKit template exposes **7882/udp** for WebRTC (UDPMux), not a 50000–60000 range. The firewall script opens both template and legacy ports.

## 3. PostgreSQL 18

1. Dokploy → **Databases** → Create → PostgreSQL **18**
2. Note internal hostname and credentials
3. Run migrations once:

**Dokploy Terminal** (zeo app container):

```bash
cd /app/shared/db && bunx --bun drizzle-kit migrate
```

Or from your machine:

```bash
DATABASE_URL=postgresql://... bun run db:migrate
```

Grant `contributor` / `admin` roles in `auth.users` for room creators.

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

## 5. Deploy zeo (Railpack)

Same pattern as **watchlist** — inline build command, monorepo root.

1. Dokploy → **Applications** → **Create**
2. **Source:** Git → `pocket-dimension`, branch `main`
3. **Build type:** **Railpack**
4. **Root directory:** `/` (monorepo root)
5. **Port:** `3008`

Railpack env (copy from `apps/zeo/.env.example`):

```env
RAILPACK_BUILD_CMD=bun install --frozen-lockfile && bun build:app:zeo
RAILPACK_START_CMD=cd apps/zeo && bun run start
```

If install fails with `lockfile is frozen`, add:

```env
RAILPACK_INSTALL_CMD=bun install
```

Run migrations separately after deploy (Dokploy Terminal on zeo container):

```bash
cd /app/shared/db && bunx --bun drizzle-kit migrate
```

Domain: **`zeo.z0xm.com`** with HTTPS (Cloudflare SSL: Full strict if proxied).

App env (see [../env/production.env.example](../env/production.env.example)) — **LiveKit keys come from the LiveKit template in step 6**:

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

LIVEKIT_API_KEY=<API_KEY from LiveKit template>
LIVEKIT_API_SECRET=<API_SECRET from LiveKit template>
LIVEKIT_URL=https://zeo-livekit.z0xm.com
PUBLIC_LIVEKIT_URL=wss://zeo-livekit.z0xm.com
```

Deploy and verify:

```bash
curl -sf https://zeo.z0xm.com/health
# {"status":"ok","app":"zeo"}
```

## 6. Deploy LiveKit (Dokploy template)

Use the official **[Dokploy LiveKit template](https://docs.dokploy.com/docs/templates/livekit)** — not a custom compose file from this repo.

### 6.1 Deploy the template

1. Dokploy → **Templates** → search **LiveKit** → **Deploy**
2. Set your base domain or customize generated hostnames:
   - **Main domain (WSS):** `zeo-livekit.z0xm.com`
   - **Turn domain (TURN TLS):** `zeo-livekit-turn.z0xm.com`
   - **WHIP domain:** only needed if you use ingress/recording — zeo calls do not require it
3. Deploy. The template creates:
   - `livekit` — LiveKit server (`livekit/livekit-server:v1.9.0` in the template — **upgrade to v1.9.12+**, see §6.2)
   - `redis` — required by the template
   - `egress` / `ingress` — optional for zeo; safe to leave running or remove from compose if you want a lighter stack

The template auto-generates **`API_KEY`** and **`API_SECRET`**. Copy them from the Compose project's **Environment** tab into zeo env (`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`).

### 6.2 Upgrade LiveKit server + fix livekit.yaml

**zeo uses `livekit-client` 2.20**, which connects to **`/rtc/v1`**. The Dokploy template ships **`livekit-server:v1.9.0`**, which only has **`/rtc`** (legacy). Symptom: browser console shows WebSocket failure on `/rtc/v1?access_token=…` while `https://zeo-livekit…/rtc/validate` returns 401.

In your Compose file, bump the image:

```yaml
livekit:
  image: livekit/livekit-server:v1.9.12   # was v1.9.0
```

Redeploy the stack, then verify:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://zeo-livekit.z0xm.com/rtc/v1/validate   # 400 without token (endpoint exists; was 404 on v1.9.0)
curl -s https://zeo-livekit.z0xm.com/rtc/v1/validate?access_token=invalid              # body: invalid authorization token, HTTP 401
```

Also edit **`livekit.yaml`** in Dokploy → Files:

1. Set **`turn.domain`** to **`zeo-livekit-turn.z0xm.com`**, not the sslip.io hostname the template generated.
2. Append room limits and webhook from [../livekit/dokploy-template-overlay.yaml.example](../livekit/dokploy-template-overlay.yaml.example):

```yaml
room:
  max_participants: 12
  empty_timeout: 300

webhook:
  urls:
    - https://zeo.z0xm.com/api/webhooks/livekit
  api_key: <same API_KEY as template env>
```

3. Redeploy the LiveKit stack

If you use ingress/WHIP, update `ingress.rtmp_base_url` and `ingress.whip_base_url` to your real domains too. zeo calls do not need ingress.

**zeo env:** `PUBLIC_LIVEKIT_URL` must be **`wss://zeo-livekit.z0xm.com`** (no `:7880` port — port 7880 is plain HTTP only).

### 6.3 Fix Traefik 404 on HTTPS (dokploy-network)

If **`http://zeo-livekit.z0xm.com:7880/`** returns `OK` but **`https://zeo-livekit.z0xm.com/`** returns `404 page not found`, Traefik cannot reach the container. The template compose omits `dokploy-network`.

Add to your compose (see [../livekit/dokploy-compose-network-overlay.yml.example](../livekit/dokploy-compose-network-overlay.yml.example)):

```yaml
networks:
  dokploy-network:
    external: true

services:
  livekit:
    networks:
      - dokploy-network
    labels:
      - traefik.docker.network=dokploy-network
```

**Redeploy** the stack after editing compose or changing Domains. Quick test on the VPS:

```bash
docker network connect dokploy-network <livekit-container-name>
```

Then `curl -s https://zeo-livekit.z0xm.com/` should print `OK`.

### 6.4 Template ports and domains (reference)

Default template values ([docs](https://docs.dokploy.com/docs/templates/livekit)):

| Variable | Default | Purpose |
|----------|---------|---------|
| `LIVEKIT_PORT` | 7880 | Signal / WSS (Traefik → `zeo-livekit`) |
| `LIVEKIT_TCP_PORT` | 7881 | ICE TCP |
| `LIVEKIT_UDP_PORT` | 7882 | WebRTC media (UDPMux) |
| `TURN_UDP_PORT` | 3478 | TURN UDP |
| `TURN_TLS_PORT` | 5349 | TURN TLS (Traefik → `zeo-livekit-turn`) |

Traefik domains are configured automatically by the template for signal and TURN.

### 6.5 Verify LiveKit

WebSocket check:

```bash
curl -sI \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  https://zeo-livekit.z0xm.com | head -5
```

Expect `101 Switching Protocols` when LiveKit is running. Root path should return `OK`:

```bash
curl -s https://zeo-livekit.z0xm.com/
```

### 6.6 Sync keys and redeploy zeo

After LiveKit is up, confirm zeo has matching `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` and redeploy zeo if you changed them.

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
| `/rtc/v1` WebSocket fails, `/rtc/validate` works | Template server is **v1.9.0**; upgrade to **v1.9.12+** (§6.2). Bare `curl …/rtc/v1/validate` → **400** is OK; **404** means still on old server. `PUBLIC_LIVEKIT_URL=wss://zeo-livekit.z0xm.com` (no port) |
| `https://zeo-livekit…` → 404 but `:7880` → OK | Add `livekit` to `dokploy-network`; redeploy (§6.3) |
| HTTPS self-signed / LE fails | TURN/signal domains must be **DNS only** (grey cloud); redeploy after Domains change |
| TURN fails on mobile | `turn.domain` = `zeo-livekit-turn.z0xm.com` in `livekit.yaml`, not sslip.io |
| Calls connect but no video | Grey cloud on `zeo-livekit` and `zeo-livekit-turn`? **7882/udp** open on Hostinger? |
| WebSocket failed | Template domain on LiveKit service port 7880; Traefik WebSocket enabled |
| Webhook / wrong participant count | `webhook` block in template `livekit.yaml`; keys match zeo env |
| Auth redirect loop | `BETTER_AUTH_TRUSTED_ORIGINS`, `BETTER_AUTH_COOKIE_DOMAIN=.z0xm.com` |
| Build fails / frozen lockfile | Root = repo root. Match watchlist: `RAILPACK_BUILD_CMD=bun install --frozen-lockfile && bun build:app:zeo`. Or set `RAILPACK_INSTALL_CMD=bun install` |
| `uuidv7()` migration error | PostgreSQL must be **18+** |
| Template deploy stuck | Large UDP port ranges can hang Docker — template uses single **7882/udp** by design |

## 9. File index

| File | Purpose |
|------|---------|
| [../../.env.example](../../.env.example) | Railpack + app env reference |
| [cloudflare-dns.md](./cloudflare-dns.md) | DNS proxy rules |
| [../livekit/dokploy-template-overlay.yaml.example](../livekit/dokploy-template-overlay.yaml.example) | Webhook + room limits for template `livekit.yaml` |
| [../livekit/dokploy-compose-network-overlay.yml.example](../livekit/dokploy-compose-network-overlay.yml.example) | Fix Traefik 404 — attach `dokploy-network` |
| [../livekit/docker-compose.dokploy.yml](../livekit/docker-compose.dokploy.yml) | **Alternative** custom compose (not needed if using template) |
| [../env/production.env.example](../env/production.env.example) | Env reference |
| [../firewall/ufw-rules.example.sh](../firewall/ufw-rules.example.sh) | VPS firewall ports |

**External:** [Dokploy LiveKit template docs](https://docs.dokploy.com/docs/templates/livekit)
