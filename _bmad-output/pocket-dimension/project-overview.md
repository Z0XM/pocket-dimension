# Pocket Dimension — Project Overview

**Date:** 2026-08-23  
**Type:** Monorepo (13 parts)  
**Architecture:** Shared auth/db libraries + Elysia auth API + SvelteKit apps

## Executive Summary

Pocket Dimension is a Bun + Turbo monorepo of personal apps that share Better Auth, Drizzle/PostgreSQL 18, and a small utils package. Auth-backed apps talk to `auth-service` (Elysia, port 5001) and query named PostgreSQL schemas. Standalone apps (`rhymes`, `markitdown`, `pocket`) do not use auth or the shared DB. `zeo` adds LiveKit SFU video and an internal music worker.

## Project Classification

- **Repository Type:** monorepo (`apps/**`, `shared/**`, `scripts/**`)
- **Project Types:** library (3), backend (2), web (8)
- **Primary Languages:** TypeScript, Svelte 5, SQL (Drizzle migrations)
- **Architecture Pattern:** Shared packages → auth service → full-stack SvelteKit apps; optional workers

## Multi-Part Structure

| Part | Path | Type | Purpose |
| --- | --- | --- | --- |
| shared-utils | `shared/utils` | library | Zod env validation |
| shared-db | `shared/db` | library | Drizzle client + all app schemas + migrations |
| shared-auth | `shared/auth` | library | Better Auth instance (email, username, magic link, Resend) |
| auth-service | `apps/auth-service` | backend | HTTP auth API on port 5001 |
| watchlist | `apps/watchlist` | web | Collaborative media watchlist (3002) |
| rhymes | `apps/rhymes` | web | Literary reader from markdown corpus (3003); rework in progress |
| howwasyourday | `apps/howwasyourday` | web | Daily journal + push reminders (3004) |
| chhan-chhan | `apps/chhan-chhan` | web | Personal finance ledger (3005) |
| me-via-you | `apps/me-via-you` | web | Anonymous feedback forms (3006) |
| markitdown | `apps/markitdown` | web | File-to-Markdown converter + Python (3009) |
| pocket | `apps/pocket` | web | Hub that links sibling apps (3007) |
| zeo | `apps/zeo` | web | Group video + games + shared listening (3008) |
| zeo-music-worker | `apps/zeo-music-worker` | backend | yt-dlp/ffmpeg → LiveKit audio bot (3010) |

### How Parts Integrate

Auth-backed SvelteKit apps import `@pocket-dimension/auth` in `hooks.server.ts` and `@pocket-dimension/db` for queries. Browser clients call `auth-service` via `PUBLIC_BASE_AUTH_URL`. All app tables FK to `auth.user`. zeo additionally talks to LiveKit and `zeo-music-worker`. pocket only reads env URLs — it does not proxy traffic.

## Technology Stack Summary

| Category | Technology | Version / note |
| --- | --- | --- |
| Runtime | Bun | 1.3.5 (packageManager) |
| Language | TypeScript | 5.9+ |
| Monorepo | Turbo | 2.7 |
| Web | SvelteKit 2 + Svelte 5 | svelte-adapter-bun |
| CSS | Tailwind CSS | 4.x |
| Auth API | Elysia | 1.4 |
| Auth | Better Auth | 1.4 |
| ORM | Drizzle + pg | 0.45 / 8.16 |
| Database | PostgreSQL | **18+** (`uuidv7()`) |
| Media (zeo) | LiveKit | client 2.20, server-sdk 2.15 |
| Email | Resend | required non-empty API key to boot auth |
| Convert | Python markitdown | markitdown app only |

## Architecture Type

Layered monorepo: shared libraries, one auth HTTP service, many independently deployed SvelteKit apps, one worker. Not a single SPA and not a shared BFF beyond auth-service.

## Repository Structure

See [source-tree-analysis.md](./source-tree-analysis.md) and [integration-architecture.md](./integration-architecture.md).

## Existing Planning (do not duplicate)

- Rhymes rework: `planning-artifacts/` and `implementation-artifacts/` in this folder
- zeo: `_bmad-output/zeo/`
- chhan-chhan brownfield: `_bmad-output/chhan-chhan/planning-artifacts/`

## Getting Started

See [development-guide.md](./development-guide.md). Short path: PostgreSQL 18 up → `bun install && bun run build` → `bun run db:migrate` → `bun run dev:app:auth` plus the app you need.
