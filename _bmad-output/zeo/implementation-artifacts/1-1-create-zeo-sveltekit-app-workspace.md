# Story 1.1: Create zeo SvelteKit app workspace

**Epic:** 1 — Platform scaffold and auth integration  
**Status:** in-progress

## User story

**As a** developer,  
**I want** `apps/zeo` scaffolded with SvelteKit and Bun,  
**So that** zeo follows monorepo conventions.

## Acceptance criteria

- [ ] Package `@pocket-dimension/zeo` exists with `dev`, `build`, `lint`, `typecheck` scripts
- [ ] Root `package.json` includes `dev:app:zeo` and `build:app:zeo`
- [ ] App runs on port **3008** locally
- [ ] `GET /health` returns 200

## Implementation notes

- Mirror `apps/pocket` minimal scaffold; zeo dark theme per DESIGN.md (mint accent)
- Port via `PORT=3008` in `.env.example`
- Health endpoint: simple JSON `{ status: "ok" }` (no DB until Story 1.3)

## References

- `_bmad-output/zeo/planning-artifacts/architecture.md`
- `_bmad-output/zeo/project-context.md`
