# rhymes — deployment

Standalone SvelteKit app (svelte-adapter-bun). No `@pocket-dimension/*` runtime deps, but Docker/Railpack still use monorepo root for the Bun lockfile and workspace install.

## Recommended: Dockerfile (Dokploy)

Same monorepo context rules as other apps — see [DEPLOY.md](../../DEPLOY.md).

### Option A (simplest)

| Dokploy field | Value |
|---------------|-------|
| Build type | **Dockerfile** |
| **Build Path** | **`/`** |
| **Docker Context Path** | `.` |
| **Dockerfile Path** | `apps/rhymes/Dockerfile` |
| Port | `3003` |

### Option B (app folder as Build Path)

| Dokploy field | Value |
|---------------|-------|
| Build Path | `apps/rhymes` |
| **Docker Context Path** | **`/`** (not `.`) |
| Dockerfile Path | `Dockerfile` |
| Port | `3003` |

## Alternative: Railpack

| Setting | Value |
|---------|-------|
| Root directory | `apps/rhymes` **or** `/` |
| Build type | Railpack |
| Port | `3003` |

If root is `/`, add to Dokploy **Environment**:

```env
RAILPACK_CONFIG_FILE=apps/rhymes/railpack.json
```

If root is `apps/rhymes`, `railpack.json` is auto-detected.

### Application env

```env
NODE_ENV=production
PORT=3003
ORIGIN=https://rhymes.example.com
```

## Local smoke test

From monorepo root:

```bash
./apps/rhymes/scripts/deploy-build.sh
cd apps/rhymes && bun run start
```

Or Docker:

```bash
docker build -f apps/rhymes/Dockerfile -t rhymes .
docker run --rm -p 3003:3003 -e ORIGIN=http://localhost:3003 rhymes
```

## Troubleshooting

**`"/turbo.json": not found` during Docker build**

Build Path is `apps/rhymes` but Docker Context Path is `.`. Use Option A or set Context Path to **`/`**.
