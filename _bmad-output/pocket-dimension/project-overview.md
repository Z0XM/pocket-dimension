# Project Overview — Pocket Dimension

Personal Bun + Turbo monorepo of small apps. Auth-backed apps share Better Auth and named PostgreSQL 18 schemas. Standalone apps skip auth/DB. zeo adds LiveKit; Heimdall is the BMAD War Room.

**Scan:** Deep full rescan 2026-08-31 (monorepo + tools + shared packages).

## Classification

| Field | Value |
| --- | --- |
| Repository type | Monorepo |
| Primary language | TypeScript |
| Package manager | Bun 1.3.5 (`packageManager` field) |
| Node | ≥ 22.12.0 (`.node-version`) |
| Orchestration | Turbo 2.x |
| Architecture | Shared libraries → auth-service → independently deployed apps |
| CI | None (husky pre-commit only) |

## Documented parts (this scan)

| Part | Path | Type | BMAD folder |
| --- | --- | --- | --- |
| monorepo-tools | `.` / `scripts/` | infra | this folder (`architecture-monorepo-tools.md`) |
| shared-utils | `shared/utils` | library | `_bmad-output/shared-utils/` |
| shared-db | `shared/db` | library | `_bmad-output/shared-db/` |
| shared-auth | `shared/auth` | library | `_bmad-output/shared-auth/` |

## Full apps map (ports)

| Part | Path | Port | Auth/DB? |
| --- | --- | --- | --- |
| auth-service | `apps/auth-service` | 5001 | yes |
| watchlist | `apps/watchlist` | 3002 | yes |
| rhymes | `apps/rhymes` | 3003 | no |
| howwasyourday | `apps/howwasyourday` | 3004 | yes |
| chhan-chhan | `apps/chhan-chhan` | 3005 | yes |
| me-via-you | `apps/me-via-you` | 3006 | yes |
| pocket | `apps/pocket` | 3007 | no |
| zeo | `apps/zeo` | 3008 | yes |
| markitdown | `apps/markitdown` | 3009 | no (+ Python) |
| zeo-music-worker | `apps/zeo-music-worker` | 3010 | worker |
| dashboard | `apps/dashboard` | 3011 | no |
| heimdall | `apps/heimdall` | 5174/5175 · 3012 | no |

## Layering

```
shared/utils  →  shared/db  →  shared/auth
                      ↓              ↓
                 auth-backed apps   auth-service (:5001)
                 (SvelteKit)        ↑ browser clients via PUBLIC_BASE_AUTH_URL
```

Standalone: `rhymes`, `markitdown`, `pocket`, `dashboard`, `heimdall`.

## Tooling (summary)

- Workspaces: `apps/**`, `shared/**`, `scripts/**`
- Most root scripts run through `./scripts/turbo-no-prefix.sh` (strips Turbo log prefixes)
- Shared packages must build `dist/` before apps consume them (`turbo` `^build`)
- Format/lint: Prettier (root README Biome mentions are stale)
- Detail: [architecture-monorepo-tools.md](./architecture-monorepo-tools.md)

## BMAD / Heimdall

Modules mode — peer folders under `_bmad-output/`. This folder is the **Monorepo** module. Packages are siblings under `shared-*`.
