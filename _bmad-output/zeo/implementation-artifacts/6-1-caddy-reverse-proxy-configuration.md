# Story 6.1: Caddy reverse proxy configuration

**Epic:** 6 — Production deployment on Hostinger  
**Status:** done

## Acceptance criteria

- [x] Caddyfile template for **zeo.z0xm.com** + **zeo-livekit.z0xm.com**
- [x] Let's Encrypt automatic certs documented
- [x] WebSocket upgrade works for LiveKit

## Implementation

- `deploy/caddy/Caddyfile.example` — reverse proxy to :3008 and :7880
- `deploy/caddy/README.md` — install, validate, ACME, WebSocket verification
