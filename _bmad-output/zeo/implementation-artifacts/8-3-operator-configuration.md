# Story 8.3: Operator configuration

**Epic:** 8 — Admin and scheduling  
**Status:** done

## Acceptance criteria

- [x] FR-44: adjust global limits and feature flags via admin dashboard

## Implementation

- `zeo.operator_settings` table with singleton row
- `GET/PATCH /api/admin/settings` — max rooms/participants, chat, waiting room default, scheduled rooms toggle
- `getOperatorSettings()` used by room capacity, token mint, chat API
- Admin dashboard configuration section
