# Caddy reverse proxy (zeo production)

Terminates HTTPS for the zeo app and LiveKit WebSocket endpoint on Hostinger KVM 2.

## Domains

| Host | Backend | Purpose |
|------|---------|---------|
| `zeo.z0xm.com` | `localhost:3008` | SvelteKit app (HTML, API, auth callbacks) |
| `zeo-livekit.z0xm.com` | `localhost:7880` | LiveKit signal / WebSocket (`wss://`) |

## Prerequisites

1. DNS `A` records for both hostnames → VPS public IPv4.
2. Hostinger firewall + `ufw` allow **80/tcp** and **443/tcp** (Caddy HTTP-01 + HTTPS).
3. LiveKit running on the host (see `../livekit/README.md`).

## Install Caddy (Ubuntu/Debian)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

## Deploy Caddyfile

```bash
sudo cp Caddyfile.example /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl enable --now caddy
sudo systemctl reload caddy
```

Caddy requests **Let's Encrypt** certificates on first request to each hostname. Check:

```bash
sudo journalctl -u caddy -f
curl -sI https://zeo.z0xm.com/health | head -3
```

## WebSocket verification

LiveKit clients connect to `wss://zeo-livekit.z0xm.com`. Verify the upgrade path:

```bash
curl -sI \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  https://zeo-livekit.z0xm.com | grep -iE 'HTTP|upgrade'
```

Expect `101 Switching Protocols` when LiveKit is running.

## App env after Caddy is live

Set in `/etc/zeo/env` (see `../env/production.env.example`):

```env
ORIGIN=https://zeo.z0xm.com
PUBLIC_LIVEKIT_URL=wss://zeo-livekit.z0xm.com
LIVEKIT_URL=wss://zeo-livekit.z0xm.com
BETTER_AUTH_TRUSTED_ORIGINS=https://zeo.z0xm.com,https://auth.z0xm.com
```

Restart zeo after updating env: `sudo systemctl restart zeo`.
