# Source Tree Analysis

```
pocket-dimension/
├── apps/
│   ├── auth-service/          # Elysia auth API (Part: auth-service) :5001
│   │   └── src/
│   │       ├── index.ts       # Entry: CORS, swagger, listen
│   │       ├── routes/auth.ts # Better Auth HTTP wrappers
│   │       └── middlewares/auth.ts
│   ├── watchlist/             # Media watchlist (Part: watchlist) :3002
│   │   └── src/routes/        # (public) table/dashboard; (auth); api/
│   ├── rhymes/                # Literary reader (Part: rhymes) :3003
│   │   ├── src/assets/rhymes/ # Markdown corpus (~167 files) — content, not docs
│   │   ├── src/lib/loadRhymes.ts
│   │   └── src/routes/        # / and /[slug]
│   ├── howwasyourday/         # Daily journal (Part: howwasyourday) :3004
│   ├── chhan-chhan/           # Finance ledger (Part: chhan-chhan) :3005
│   ├── me-via-you/            # Feedback forms (Part: me-via-you) :3006
│   ├── markitdown/            # File→MD (Part: markitdown) :3009
│   │   ├── python/convert.py
│   │   └── src/routes/api/convert/
│   ├── pocket/                # Hub (Part: pocket) :3007
│   ├── zeo/                   # Video + games + listening (Part: zeo) :3008
│   │   ├── src/lib/livekit/
│   │   ├── src/lib/server/
│   │   ├── src/lib/components/call/
│   │   └── deploy/            # Dokploy, LiveKit, Caddy, firewall
│   └── zeo-music-worker/      # Listening bot (Part: zeo-music-worker) :3010
│       └── src/index.ts
├── shared/
│   ├── utils/src/index.ts     # validateEnv (Part: shared-utils)
│   ├── db/                    # Part: shared-db
│   │   ├── src/schema/        # auth, watchlist, howwasyourday, chhanchhan, meviayou, zeo
│   │   └── migrations/
│   └── auth/src/              # Part: shared-auth — betterAuth() + Resend
├── scripts/                   # Workspace helpers (e.g. rhymes markdown export)
├── _bmad-output/
│   ├── pocket-dimension/      # This brownfield pack + rhymes rework artifacts
│   ├── zeo/
│   └── chhan-chhan/
├── package.json               # bun workspaces + turbo scripts
├── turbo.json
├── DEPLOY.md
├── AGENTS.md
└── README.md
```

## Critical folders

| Path | Purpose |
| --- | --- |
| `shared/db/src/schema/` | All tables; edit here, then generate migrations |
| `shared/auth/src/index.ts` | Cookie/session policy for every auth app |
| `apps/auth-service/src/routes/auth.ts` | Public auth HTTP surface |
| `apps/*/src/hooks.server.ts` | Session + route gates (auth apps) |
| `apps/*/src/routes/` | Pages and `+server.ts` APIs |
| `apps/zeo/src/lib/server/` | Rooms, tokens, listening, game, authz |
| `apps/chhan-chhan/src/lib/importers/` | Bank statement parsers |
| `apps/rhymes/src/assets/rhymes/` | Legacy content corpus |

## Entry points

| Part | Entry |
| --- | --- |
| auth-service | `apps/auth-service/src/index.ts` |
| SvelteKit apps | `src/routes/` + `svelte-adapter-bun` → `build/index.js` |
| zeo prod | `apps/zeo/scripts/start.sh` (migrate then start) |
| zeo-music-worker | `apps/zeo-music-worker/src/index.ts` |
| markitdown convert | `apps/markitdown/python/convert.py` via `Bun.spawn` |

## Excluded from Deep scan

`node_modules`, `dist`, `.astro`, `apps/rhymes/src/assets/rhymes/*.md` (content), `src/lib/components/ui/**` (shadcn/bits-ui copies).
