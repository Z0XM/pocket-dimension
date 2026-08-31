# Source Tree Analysis — Pocket Dimension

Annotated monorepo tree. Package detail lives in peer `_bmad-output/shared-*` modules; app detail in app trees when present.

```
pocket-dimension/
├── apps/
│   ├── auth-service/          # Elysia Better Auth HTTP API (:5001)
│   ├── watchlist/             # SvelteKit (:3002) auth + DB
│   ├── rhymes/                # SvelteKit (:3003) standalone
│   ├── howwasyourday/         # SvelteKit (:3004) auth + DB
│   ├── chhan-chhan/           # SvelteKit (:3005) finance ledger
│   ├── me-via-you/            # SvelteKit (:3006) auth + DB
│   ├── pocket/                # SvelteKit hub (:3007)
│   ├── zeo/                   # SvelteKit + LiveKit (:3008)
│   ├── markitdown/            # SvelteKit + Python (:3009)
│   ├── zeo-music-worker/      # Bun worker (:3010)
│   ├── dashboard/             # SvelteKit (:3011)
│   └── heimdall/              # Vite/React War Room (:5174/5175 · :3012)
├── shared/
│   ├── utils/                 # @pocket-dimension/utils
│   ├── db/                    # @pocket-dimension/db (+ migrations/)
│   └── auth/                  # @pocket-dimension/auth
├── scripts/                   # workspace tooling (@pocket-dimension/scripts)
├── _bmad-output/              # BMAD SoR — Modules layout (see README there)
├── _bmad/                     # BMAD Method install + config
├── heimdall.config.mjs        # Heimdall Modules dogfood config
├── AGENTS.md                  # Cloud / env caveats
├── DEPLOY.md                  # root-context deploy contract
├── package.json               # workspaces + root scripts
└── turbo.json                 # pipeline
```

## Critical paths

| Path | Why it matters |
| --- | --- |
| `shared/db/src/schema/` | All Drizzle tables; named PG schemas |
| `shared/db/migrations/` | SQL migrations; needs PG18 `uuidv7()` |
| `shared/auth/src/index.ts` | Single Better Auth export |
| `apps/auth-service/` | Public auth HTTP boundary |
| `heimdall.config.mjs` | War Room module paths |
| `_bmad-output/<module>/` | Per-scope planning + docs |

## Entry patterns

- **Auth HTTP:** `apps/auth-service` → `auth.api.*`
- **SvelteKit auth apps:** `hooks.server.ts` → `auth` + `svelteKitHandler`; client → `PUBLIC_BASE_AUTH_URL`
- **DB:** `import { db, schema } from "@pocket-dimension/db"`
- **Heimdall CLI:** `bun run heimdall` → `apps/heimdall/bin/heimdall.cjs`
