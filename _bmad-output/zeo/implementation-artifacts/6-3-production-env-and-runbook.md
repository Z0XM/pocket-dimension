# Story 6.3: Production env and runbook

**Epic:** 6 — Production deployment on Hostinger  
**Status:** done

## Acceptance criteria

- [x] Document env vars for zeo, LiveKit, auth-service, DB
- [x] systemd or compose commands for start/stop/logs
- [x] Health check verification steps post-deploy

## Implementation

- `deploy/README.md` — full Hostinger KVM 2 runbook
- `deploy/env/production.env.example` — zeo + auth-service + LiveKit env reference
- `deploy/systemd/zeo.service.example` — systemd unit
- `deploy/livekit/docker-compose.prod.yml.example` — LiveKit start/stop/logs
- Post-deploy health checks: `/health`, LiveKit WSS, webhook route, E2E call test
