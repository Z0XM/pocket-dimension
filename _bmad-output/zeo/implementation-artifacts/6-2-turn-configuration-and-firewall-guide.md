# Story 6.2: TURN configuration and firewall guide

**Epic:** 6 — Production deployment on Hostinger  
**Status:** done

## Acceptance criteria

- [x] TURN enabled in LiveKit or coturn sidecar documented
- [x] Hostinger + ufw port checklist in deploy README
- [x] Client ICE servers include TURN in token or config

## Implementation

- `deploy/livekit/livekit.prod.yaml.example` — embedded TURN (`turn.enabled`, domain, ports)
- `deploy/coturn/` — optional coturn sidecar + `turnserver.conf.example`
- `deploy/firewall/ufw-rules.example.sh` — ufw port checklist
- `lib/server/livekit-token.ts` — `clientIceServers()` for external coturn
- Token API returns `iceServers` when `LIVEKIT_TURN_*` env set; LiveKit embedded TURN uses signaling (documented)
