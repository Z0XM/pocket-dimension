#!/usr/bin/env bash
# Hostinger KVM 2 + ufw port checklist for zeo production.
# Review before running — adjust SSH port if not 22.
#
# Usage: sudo bash ufw-rules.example.sh

set -euo pipefail

echo "Applying ufw rules for zeo + LiveKit + TURN..."

ufw default deny incoming
ufw default allow outgoing

# SSH (change if you use a non-default port)
ufw allow 22/tcp comment 'SSH'

# Traefik / Dokploy / Caddy — HTTPS
ufw allow 80/tcp comment 'HTTP (ACME + redirect)'
ufw allow 443/tcp comment 'HTTPS (zeo app + LiveKit WSS via Traefik/Caddy)'

# LiveKit ICE TCP (direct, not proxied)
ufw allow 7881/tcp comment 'LiveKit ICE TCP'

# LiveKit WebRTC media UDP range (must match livekit.prod.yaml rtc.port_range_*)
ufw allow 50000:60000/udp comment 'LiveKit WebRTC media'

# LiveKit embedded TURN
ufw allow 3478/udp comment 'TURN UDP'
ufw allow 3478/tcp comment 'TURN TCP'
ufw allow 5349/tcp comment 'TURN TLS'

# TURN relay range (LiveKit embedded TURN default)
ufw allow 49152:65535/udp comment 'TURN relay'

ufw --force enable
ufw status verbose

echo ""
echo "Also open the same ports in the Hostinger VPS firewall panel (hPanel → VPS → Firewall)."
