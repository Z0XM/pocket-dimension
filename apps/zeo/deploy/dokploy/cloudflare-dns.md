# Cloudflare DNS for zeo + LiveKit

Configure in **Cloudflare → DNS → Records** for `z0xm.com` (adjust zone as needed).

| Name | Type | Content | Proxy | Notes |
|------|------|---------|-------|-------|
| `zeo` | A | Hostinger VPS IP | **Proxied** (orange) | SvelteKit app via Dokploy Traefik |
| `zeo-livekit` | A | Hostinger VPS IP | **DNS only** (grey) | LiveKit WSS + TURN — must NOT be proxied |
| `auth` | A | Hostinger VPS IP | Proxied or DNS only | auth-service (if not already set) |

## Cloudflare settings

### `zeo.z0xm.com` (proxied)

- **SSL/TLS mode:** Full (strict) — Dokploy/Traefik must present a valid origin certificate
- **WebSockets:** Enabled (Network → WebSockets ON)
- Optional: Page Rule / Configuration Rule — no caching on `/api/*` and `/room/*`

### `zeo-livekit.z0xm.com` (DNS only — required)

WebRTC media and TURN use **UDP/TCP directly to your VPS**. Cloudflare orange-cloud proxy only handles HTTP(S) and breaks LiveKit calls if enabled on this hostname.

Do **not** enable Cloudflare proxy for `zeo-livekit`.

## Hostinger firewall

Cloudflare does not replace VPS firewall rules. Still open on Hostinger hPanel + ufw:

- 443/tcp (Traefik / Dokploy)
- 7881/tcp (LiveKit ICE TCP)
- 50000–60000/udp (WebRTC media)
- 3478 udp/tcp, 5349/tcp, 49152–65535/udp (TURN)

See [../firewall/ufw-rules.example.sh](../firewall/ufw-rules.example.sh).
