# Project Overview — Pocket Dimension

Personal Bun + Turbo monorepo of small apps. Auth-backed apps share Better Auth and named PostgreSQL 18 schemas. Standalone apps skip auth/DB. zeo adds LiveKit; Heimdall is the BMAD War Room.

## Classification

| Field | Value |
| --- | --- |
| Repository type | Monorepo |
| Primary language | TypeScript |
| Package manager | Bun 1.3.5 |
| Orchestration | Turbo |
| Architecture | Shared libraries → auth-service → independently deployed apps |

## Parts map

| Part | Path | Type | Notes |
| --- | --- | --- | --- |
| shared-utils | `shared/utils` | library | Zod `validateEnv` |
| shared-db | `shared/db` | library | Drizzle + all schemas |
| shared-auth | `shared/auth` | library | Better Auth instance |
| auth-service | `apps/auth-service` | backend | Elysia :5001 |
| watchlist | `apps/watchlist` | web | :3002 auth |
| rhymes | `apps/rhymes` | web | :3003 standalone |
| howwasyourday | `apps/howwasyourday` | web | :3004 auth |
| chhan-chhan | `apps/chhan-chhan` | web | :3005 auth |
| me-via-you | `apps/me-via-you` | web | :3006 auth |
| pocket | `apps/pocket` | web | :3007 hub |
| zeo | `apps/zeo` | web | :3008 + LiveKit |
| markitdown | `apps/markitdown` | web | :3009 + Python |
| zeo-music-worker | `apps/zeo-music-worker` | worker | :3010 |
| dashboard | `apps/dashboard` | web | :3011 |
| heimdall | `apps/heimdall` | web | :5174/5175 dev · :3012 prod |

## Layering

```
shared/utils  →  shared/db  →  shared/auth
                      ↓              ↓
                 auth-backed apps   auth-service (:5001)
                 (SvelteKit)        ↑ browser clients via PUBLIC_BASE_AUTH_URL
```

Standalone: `rhymes`, `markitdown`, `pocket`, `dashboard`, `heimdall`.

## BMAD / Heimdall

Modules mode — peer folders under `_bmad-output/` (see [`../README.md`](../README.md)). This folder is the **Monorepo** module. Package and app SoRs are siblings, not nested architecture dumps here.
