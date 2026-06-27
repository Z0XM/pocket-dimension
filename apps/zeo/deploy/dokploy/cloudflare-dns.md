# Cloudflare DNS for zeo + LiveKit (Dokploy template)

Configure in **Cloudflare → DNS → Records** for `z0xm.com`.

| Name | Type | Content | Proxy | Notes |
|------|------|---------|-------|-------|
| `zeo` | A | Hostinger VPS IP | **Proxied** (orange) | SvelteKit app via Dokploy Traefik |
| `zeo-livekit` | A | Hostinger VPS IP | **DNS only** (grey) | LiveKit WSS (signal) — must NOT be proxied |
| `zeo-livekit-turn` | A | Hostinger VPS IP | **DNS only** (grey) | LiveKit embedded TURN TLS |
| `auth` | A | Hostinger VPS IP | Proxied or DNS only | auth-service (if not already set) |

The [Dokploy LiveKit template](https://docs.dokploy.com/docs/templates/livekit) defaults to `livekit.${domain}` and `livekit-turn.${domain}`. When deploying, set **main domain** to `zeo-livekit.z0xm.com` and **turn domain** to `zeo-livekit-turn.z0xm.com`.

## Cloudflare settings

### `zeo.z0xm.com` (proxied)

- **SSL/TLS mode:** Full (strict)
- **WebSockets:** Enabled (Network → WebSockets ON)
- Optional: no caching on `/api/*` and `/room/*`

### `zeo-livekit` and `zeo-livekit-turn` (DNS only — required)

WebRTC media and TURN use **UDP/TCP directly to your VPS**. Cloudflare orange-cloud proxy only handles HTTP(S) and breaks LiveKit if enabled on these hostnames.

Do **not** enable Cloudflare proxy for LiveKit subdomains.

## Hostinger firewall (Dokploy template ports)

The Dokploy template uses a **single UDP mux port** (`7882`) instead of a large port range. Open on Hostinger hPanel + ufw:

- 443/tcp (Traefik / Dokploy)
- 7881/tcp (LiveKit ICE TCP — if exposed)
- 7882/udp (WebRTC media — template default `LIVEKIT_UDP_PORT`)
- 3478 udp/tcp, 5349/tcp (TURN)

See [../firewall/ufw-rules.example.sh](../firewall/ufw-rules.example.sh) (includes both template and legacy port-range rules).
