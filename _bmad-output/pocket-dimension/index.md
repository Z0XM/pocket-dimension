# Pocket Dimension Documentation Index

**Type:** Monorepo with 13 parts  
**Primary Language:** TypeScript / Svelte  
**Architecture:** Shared auth/db + Elysia auth-service + SvelteKit apps  
**Scan:** Deep initial scan, 2026-08-23  
**Master entry for AI:** this file

## Project Overview

Personal Bun + Turbo monorepo. Auth-backed apps share Better Auth and named PostgreSQL 18 schemas. Standalone: rhymes, markitdown, pocket. zeo adds LiveKit and a music worker.

## Quick Reference by Part

| Part | Type | Root | Tech |
| --- | --- | --- | --- |
| shared-utils | library | `shared/utils` | Zod env |
| shared-db | library | `shared/db` | Drizzle, PG 18, `uuidv7` |
| shared-auth | library | `shared/auth` | Better Auth, Resend |
| auth-service | backend | `apps/auth-service` | Elysia :5001 |
| watchlist | web | `apps/watchlist` | SvelteKit :3002 |
| rhymes | web | `apps/rhymes` | SvelteKit :3003 (rework) |
| howwasyourday | web | `apps/howwasyourday` | SvelteKit :3004 |
| chhan-chhan | web | `apps/chhan-chhan` | SvelteKit :3005 |
| me-via-you | web | `apps/me-via-you` | SvelteKit :3006 |
| markitdown | web | `apps/markitdown` | SvelteKit + Python :3009 |
| pocket | web | `apps/pocket` | SvelteKit hub :3007 |
| zeo | web | `apps/zeo` | SvelteKit + LiveKit :3008 |
| zeo-music-worker | backend | `apps/zeo-music-worker` | Bun worker :3010 |

## Generated Documentation

### Cross-cutting

- [Project Overview](./project-overview.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Integration Architecture](./integration-architecture.md)
- [Data Models](./data-models.md)
- [Development Guide](./development-guide.md)
- [Deployment Guide](./deployment-guide.md)
- [Contribution Guide](./contribution-guide.md)
- [Project Context](./project-context.md)
- [project-parts.json](./project-parts.json)

### Architecture by part

- [shared-utils](./architecture-shared-utils.md)
- [shared-db](./architecture-shared-db.md)
- [shared-auth](./architecture-shared-auth.md)
- [auth-service](./architecture-auth-service.md)
- [watchlist](./architecture-watchlist.md)
- [rhymes](./architecture-rhymes.md)
- [howwasyourday](./architecture-howwasyourday.md)
- [chhan-chhan](./architecture-chhan-chhan.md) (links existing pack)
- [me-via-you](./architecture-me-via-you.md)
- [markitdown](./architecture-markitdown.md)
- [pocket](./architecture-pocket.md)
- [zeo](./architecture-zeo.md)
- [zeo-music-worker](./architecture-zeo-music-worker.md)

### API contracts

- [auth-service](./api-contracts-auth-service.md)
- [watchlist](./api-contracts-watchlist.md)
- [howwasyourday](./api-contracts-howwasyourday.md)
- [me-via-you](./api-contracts-me-via-you.md)
- [markitdown](./api-contracts-markitdown.md)
- [zeo](./api-contracts-zeo.md)
- [zeo-music-worker](./api-contracts-zeo-music-worker.md)
- chhan-chhan: [`../chhan-chhan/planning-artifacts/api-contracts.md`](../chhan-chhan/planning-artifacts/api-contracts.md)

### Component inventories

- [watchlist](./component-inventory-watchlist.md)
- [rhymes](./component-inventory-rhymes.md)
- [howwasyourday](./component-inventory-howwasyourday.md)
- [me-via-you](./component-inventory-me-via-you.md)
- [zeo](./component-inventory-zeo.md)
- chhan-chhan: [`../chhan-chhan/planning-artifacts/component-inventory.md`](../chhan-chhan/planning-artifacts/component-inventory.md)
- pocket / markitdown: covered in their architecture docs

## Existing Documentation

### Repo ops

- [README.md](../../README.md)
- [DEPLOY.md](../../DEPLOY.md)
- [AGENTS.md](../../AGENTS.md)

### Per-app ops

- `apps/*/DEPLOY.md` (auth-service, watchlist, rhymes, howwasyourday, chhan-chhan, me-via-you, pocket, zeo)
- `apps/chhan-chhan/IMPORT.md`, `FUTURE-TODO.md`
- `apps/zeo/DESIGN.md`, `apps/zeo/deploy/**`
- `apps/zeo-music-worker/README.md`

### Other BMAD trees

- [`_bmad-output/zeo/`](../zeo/project-context.md)
- [`_bmad-output/chhan-chhan/planning-artifacts/index.md`](../chhan-chhan/planning-artifacts/index.md)

### Rhymes rework (this folder)

- [PRD](./planning-artifacts/prds/prd-rhymes-revamp-2026-06-20/prd.md)
- [Architecture](./planning-artifacts/architecture.md)
- [UX](./planning-artifacts/ux-designs/ux-rhymes-revamp-2026-06-20/DESIGN.md)
- [Epics](./planning-artifacts/epics.md)
- [Stories](./implementation-artifacts/)
- [Deferred work](./implementation-artifacts/deferred-work.md) — magic-link for all auth-backed apps

## Getting Started

```bash
sudo pg_ctlcluster 18 main start
bun install && bun run build
# copy .env.example files; matching BETTER_AUTH_SECRET; non-empty RESEND_API_KEY
bun run db:migrate
bun run dev:app:auth
# then bun run dev:app:<name>
```

Details: [development-guide.md](./development-guide.md).

## Findings to be aware of

- [Deferred work](./implementation-artifacts/deferred-work.md) — magic-link sign-in for all auth-backed apps
- Almost no automated tests except zeo unit tests and chhan-chhan importers
