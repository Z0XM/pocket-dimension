# Deploying Zap

SvelteKit app (svelte-adapter-bun) with shared auth + db. Port **3013**.

Build from the **monorepo root** so `@pocket-dimension/*` workspace deps resolve. See root [DEPLOY.md](../../DEPLOY.md).

## Dokploy (Dockerfile)

| Setting | Value |
| --- | --- |
| Build type | Dockerfile |
| Dockerfile path | `apps/zap/Dockerfile` |
| Build context | `/` (repo root) |
| Port | `3013` |

## Env

Copy from `.env.example`. Required in production:

- `DATABASE_URL`, `BETTER_AUTH_SECRET`, `PUBLIC_BASE_AUTH_URL`
- R2: `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`, `S3_REGION`
- `ORIGIN=https://your-zap-host`

Apply migrations: `bun run db:migrate` (PG 18+) after deploy or when `DATABASE_URL` is set at build.

## Local

```bash
cp apps/zap/.env.example apps/zap/.env
bun run build:shared:db && bun run build:shared:auth
bun run dev:app:zap
```
