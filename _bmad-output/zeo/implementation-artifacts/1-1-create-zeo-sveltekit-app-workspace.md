# Story 1.1: Create zeo SvelteKit app workspace

**Epic:** 1 — Platform scaffold and auth integration  
**Status:** done

## User story

**As a** developer,  
**I want** `apps/zeo` scaffolded with SvelteKit and Bun,  
**So that** zeo follows monorepo conventions.

## Acceptance criteria

- [x] Package `@pocket-dimension/zeo` exists with `dev`, `build`, `lint`, `typecheck` scripts
- [x] Root `package.json` includes `dev:app:zeo` and `build:app:zeo`
- [x] App runs on port **3008** locally
- [x] `GET /health` returns 200

## Implementation notes

- Mirror `apps/pocket` minimal scaffold; zeo dark theme per DESIGN.md (mint accent)
- Port via `PORT=3008` in `.env.example`
- Health endpoint: simple JSON `{ status: "ok" }` (no DB until Story 1.3)

## References

- `_bmad-output/zeo/planning-artifacts/architecture.md`
- `_bmad-output/zeo/project-context.md`
