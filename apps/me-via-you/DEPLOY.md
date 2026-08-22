# me-via-you — deployment

SvelteKit app (svelte-adapter-bun) with shared auth and database packages.

## Recommended: Dockerfile (Dokploy)

Same monorepo context rules as auth-service — see [DEPLOY.md](../../DEPLOY.md).

### Option A (simplest)

| Dokploy field | Value |
|---------------|-------|
| Build type | **Dockerfile** |
| **Build Path** | **`/`** |
| **Docker Context Path** | `.` |
| **Dockerfile Path** | `apps/me-via-you/Dockerfile` |
| Port | `3006` |

### Option B (app folder as Build Path)

| Dokploy field | Value |
|---------------|-------|
| Build Path | `apps/me-via-you` |
| **Docker Context Path** | **`/`** (not `.`) |
| Dockerfile Path | `Dockerfile` |
| Port | `3006` |

## Alternative: Railpack

| Setting | Value |
|---------|-------|
| Root directory | `apps/me-via-you` **or** `/` |
| Build type | Railpack |
| Port | `3006` |

If root is `/`, add to Dokploy **Environment**:

```env
RAILPACK_CONFIG_FILE=apps/me-via-you/railpack.json
```

If root is `apps/me-via-you`, `railpack.json` is auto-detected.

### Application env

Copy from [`.env.example`](./.env.example). Minimum for production:

```env
NODE_ENV=production
ORIGIN=https://me-via-you.example.com
DATABASE_URL=postgresql://...
PUBLIC_BASE_AUTH_URL=https://auth.example.com
PUBLIC_BASE_AUTH_PATH=/
BETTER_AUTH_SECRET=<same as auth-service>
BETTER_AUTH_URL=https://auth.example.com
BETTER_AUTH_PATH=/
BETTER_AUTH_TRUSTED_ORIGINS=https://auth.example.com,https://me-via-you.example.com
BETTER_AUTH_COOKIE_DOMAIN=.example.com
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@example.com
```

Both services must be served over HTTPS for session cookies (`sameSite: none`, `secure: true`).

## Local smoke test

From monorepo root:

```bash
./apps/me-via-you/scripts/deploy-build.sh
cd apps/me-via-you && bun run start
```

Or Docker:

```bash
docker build -f apps/me-via-you/Dockerfile -t me-via-you .
docker run --rm -p 3006:3006 --env-file apps/me-via-you/.env me-via-you
```

## Troubleshooting

**`Could not resolve "../../vite-kysely-compat"` / missing `.svelte-kit/tsconfig.json`**

Stale source or cache. Confirm the service tracks **`main`**, redeploy with **clear build cache**. The Dockerfile fails early if `vite.config.ts` still imports `../../vite-kysely-compat`.

**`"/shared": not found` / `"/turbo.json": not found` during Docker build**

Build Path is `apps/me-via-you` but Docker Context Path is `.`. Use Option A or set Context Path to **`/`**.

**`Workspace dependency "@pocket-dimension/db" not found`**

Railpack ran auto `bun install` before the custom build. Switch to **Dockerfile** build (recommended), or redeploy with the updated `railpack.json` from this repo.
