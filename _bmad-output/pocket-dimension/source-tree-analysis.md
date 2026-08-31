# Source Tree Analysis — Pocket Dimension

Annotated monorepo tree after 2026-08-31 deep scan. Package detail: `_bmad-output/shared-*`. Tools detail: [architecture-monorepo-tools.md](./architecture-monorepo-tools.md).

```
pocket-dimension/
├── apps/
│   ├── auth-service/          # Elysia Better Auth HTTP API (:5001)
│   ├── watchlist/             # SvelteKit (:3002) auth + DB
│   ├── rhymes/                # SvelteKit (:3003) standalone
│   ├── howwasyourday/         # SvelteKit (:3004) auth + DB
│   ├── chhan-chhan/           # SvelteKit (:3005) finance
│   ├── me-via-you/            # SvelteKit (:3006) auth + DB
│   ├── pocket/                # SvelteKit hub (:3007)
│   ├── zeo/                   # SvelteKit + LiveKit (:3008)
│   ├── markitdown/            # SvelteKit + Python (:3009)
│   ├── zeo-music-worker/      # Bun worker (:3010)
│   ├── dashboard/             # SvelteKit (:3011)
│   └── heimdall/              # Vite/React War Room (:5174/5175 · :3012)
├── shared/
│   ├── utils/                 # @pocket-dimension/utils (env Zod)
│   ├── db/                    # @pocket-dimension/db (+ migrations/)
│   └── auth/                  # @pocket-dimension/auth (Better Auth)
├── scripts/                   # @pocket-dimension/scripts (ETL/seed) + turbo-no-prefix.sh
├── _bmad-output/              # BMAD Modules SoR
├── _bmad/                     # BMAD Method install
├── .changeset/                # Changesets (restricted/private)
├── .husky/                    # pre-commit: lint-staged → typecheck → build
├── heimdall.config.mjs        # Heimdall Modules dogfood config
├── AGENTS.md                  # Cloud / env caveats
├── DEPLOY.md                  # root-context deploy contract
├── package.json               # workspaces + root scripts
├── turbo.json                 # pipeline
├── tsconfig.base.json         # shared TS base (ES2022, strict)
├── .prettierrc                # Prettier (not Biome)
└── .dockerignore              # stub strategy for excluded apps
```

## Critical paths

| Path | Why it matters |
| --- | --- |
| `shared/db/src/schema/` | All Drizzle tables; named PG schemas |
| `shared/db/migrations/` | ~33 SQL migrations; needs PG18 `uuidv7()` |
| `shared/auth/src/index.ts` | Single Better Auth export |
| `scripts/turbo-no-prefix.sh` | Wrapper for almost all Turbo root scripts |
| `apps/auth-service/` | Public auth HTTP boundary |
| `heimdall.config.mjs` | War Room module paths |
| `_bmad-output/<module>/` | Per-scope planning + docs |
| `.husky/pre-commit` | Local quality gate (no CI) |

## Entry patterns

- **Auth HTTP:** `apps/auth-service` → `auth.api.*`
- **SvelteKit auth apps:** `hooks.server.ts` → `auth` + `svelteKitHandler`; client → `PUBLIC_BASE_AUTH_URL`
- **DB:** `import { db, schema } from "@pocket-dimension/db"`
- **Heimdall CLI:** `bun run heimdall` → `apps/heimdall/bin/heimdall.cjs` (needs `dist/cli.cjs` or `tsx`)
