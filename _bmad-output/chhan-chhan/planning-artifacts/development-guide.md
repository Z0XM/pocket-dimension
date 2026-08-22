# chhan-chhan — Development Guide

**Date:** 2026-08-23

## Prerequisites

- Bun (monorepo package manager)
- PostgreSQL **18+** with `DATABASE_URL`
- Auth service env: `BETTER_AUTH_SECRET`, non-empty `RESEND_API_KEY`
- App env from `apps/chhan-chhan/.env.example` (`PUBLIC_BASE_AUTH_URL=http://localhost:5001`)

## One-time / session setup

```bash
# repo root
bun install
bun run build                    # shared auth/db/utils → dist/
sudo pg_ctlcluster 18 main start
bun run db:migrate

cp apps/chhan-chhan/.env.example apps/chhan-chhan/.env
# edit secrets as needed
```

## Run

```bash
bun run dev:app:auth             # :5001
bun run dev:app:chhan-chhan      # :3005
```

Open `http://localhost:3005`. Signup works without real email; verify users by flipping `email_verified` in DB if needed. Session cookies may not stick on plain HTTP.

## Useful commands

| Task | Command |
|------|---------|
| Typecheck / svelte-check | `cd apps/chhan-chhan && bun run check` |
| Importer unit tests | `cd apps/chhan-chhan && bun test src/lib/importers/` |
| Production build | `cd apps/chhan-chhan && bun run build` |
| Reset + reimport PDF | `cd apps/chhan-chhan && bun --env-file=.env scripts/dedupe-transactions.ts <account-id> file.pdf --reset` |

## Coding conventions

- Follow existing forge UI patterns on Control / ledger
- New banks: `BankImporter` + tests + `IMPORT.md` section + register in `index.ts`
- Money: always minor units in persistence and APIs
- Mutations: authz triad (`requireUser` / membership / `canEdit`)
- BMAD artifacts for this app → `_bmad-output/chhan-chhan/` only (see `_bmad-output/README.md`)

## Deploy

See `apps/chhan-chhan/DEPLOY.md` and root `DEPLOY.md`. Build from **repository root**; port **3005**.

---

_Generated using BMAD Method `document-project` workflow_
