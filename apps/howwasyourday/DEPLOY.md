# howwasyourday — deployment

SvelteKit app (svelte-adapter-bun) with shared auth, database, and utils packages.

## Recommended: Dockerfile (Dokploy)

Same monorepo context rules as auth-service — see [DEPLOY.md](../../DEPLOY.md).

### Option A (simplest)

| Dokploy field | Value |
|---------------|-------|
| Build type | **Dockerfile** |
| **Build Path** | **`/`** |
| **Docker Context Path** | `.` |
| **Dockerfile Path** | `apps/howwasyourday/Dockerfile` |
| Port | `3004` |

### Option B (app folder as Build Path)

| Dokploy field | Value |
|---------------|-------|
| Build Path | `apps/howwasyourday` |
| **Docker Context Path** | **`/`** (not `.`) |
| Dockerfile Path | `Dockerfile` |
| Port | `3004` |

## Alternative: Railpack

| Setting | Value |
|---------|-------|
| Root directory | `/` (monorepo root) **recommended** |
| Build type | Railpack |
| Port | `3004` |

**Required** when root is `/` — otherwise Railpack auto-runs plain `bun install --frozen-lockfile` and can fail on the workspace lockfile:

```env
RAILPACK_CONFIG_FILE=apps/howwasyourday/railpack.json
```

If root is `apps/howwasyourday`, `railpack.json` is auto-detected (full git checkout still required so `../..` reaches shared packages).

### Application env

Copy from [`.env.example`](./.env.example). Minimum for production:

```env
NODE_ENV=production
ORIGIN=https://howwasyourday.example.com
DATABASE_URL=postgresql://...
PUBLIC_BASE_AUTH_URL=https://auth.example.com
PUBLIC_BASE_AUTH_PATH=/
BETTER_AUTH_SECRET=<same as auth-service>
BETTER_AUTH_URL=https://auth.example.com
BETTER_AUTH_PATH=/
BETTER_AUTH_TRUSTED_ORIGINS=https://auth.example.com,https://howwasyourday.example.com
BETTER_AUTH_COOKIE_DOMAIN=.example.com
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@example.com
PUBLIC_VAPID_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@example.com
```

Both services must be served over HTTPS for session cookies (`sameSite: none`, `secure: true`).

## Local smoke test

From monorepo root:

```bash
./apps/howwasyourday/scripts/deploy-build.sh
cd apps/howwasyourday && bun run start
```

Or Docker:

```bash
docker build -f apps/howwasyourday/Dockerfile -t howwasyourday .
docker run --rm -p 3004:3004 --env-file apps/howwasyourday/.env howwasyourday
```

## Legacy 2025 year recap (ops)

Frozen dashboards live in Postgres (`howwasyourday.legacy_recap_*`). JSON/PNGs are **not** in git.

1. Apply migrations: `bun run db:migrate` (from monorepo root; needs PG18).
2. Build a private email map JSON `{ "slug": "email@…" }` (copy from `scripts/legacy-recap-emails.example.json`). Never commit real emails.
3. Point at a local year-recap export (dashboard root with `src/data/*.json` + `public/drawings/`):

```bash
cd apps/howwasyourday
YEAR_RECAP_EXPORT_DIR=/path/to/year-recap/dashboard \
YEAR_RECAP_EMAILS_FILE=./scripts/legacy-recap-emails.json \
bun run import:legacy-recap-2025
```

4. App routes: public `/recap/2025`, claim `/recap/2025/claim/[slug]`, gated `/recap/2025/[slug]`. OTP uses `RESEND_API_KEY`. Claim cookies use `LEGACY_RECAP_CLAIM_SECRET` or `BETTER_AUTH_SECRET`.
5. Optional AI year summaries (offline, claim-gated): see [`scripts/ai-analysis/README.md`](./scripts/ai-analysis/README.md) — `build:legacy-recap-ai-briefs` → one Cursor subagent per slug → `import:legacy-recap-ai-analysis`. No in-app LLM.

## Troubleshooting

**`Could not resolve "../../vite-kysely-compat"` / missing `.svelte-kit/tsconfig.json`**

Stale source or cache. Confirm the service tracks **`main`**, redeploy with **clear build cache**. The Dockerfile fails early if `vite.config.ts` still imports `../../vite-kysely-compat`.

**`"/shared": not found` / `"/turbo.json": not found` during Docker build**

Build Path is `apps/howwasyourday` but Docker Context Path is `.`. Use Option A or set Context Path to **`/`**.

**`Workspace dependency "@pocket-dimension/db" not found`**

Railpack ran auto `bun install` before the custom build. Switch to **Dockerfile** build (recommended), or redeploy with the updated `railpack.json` from this repo.
