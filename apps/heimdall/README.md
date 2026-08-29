# @pocket-dimension/heimdall

BMAD / docs **War Room** app for Pocket Dimension (`apps/heimdall`). Serves monorepo `_bmad-output` trees via SPA + CLI.

## Install

```bash
# from monorepo root
bun install
```

## Quick start

```bash
# from monorepo root:
bun run heimdall doctor
bun run heimdall dev
# or:
bun run dev:app:heimdall
```

Or from the app:

```bash
cd apps/heimdall
bun run heimdall doctor
bun run dev
```

Open the printed UI URL (default `http://127.0.0.1:5174/` — site root).

## Production

```bash
bun run build:app:heimdall   # from monorepo root
cd apps/heimdall && bun run start   # http://127.0.0.1:3012/
```

Deploy (Dokploy Dockerfile / Railpack): see [DEPLOY.md](./DEPLOY.md). Env knobs: [.env.example](./.env.example).

## Authoring

See [docs/AUTHORING.md](./docs/AUTHORING.md) for Soft-empty, doctor, Features/Delivery layout (flat and Modules modes), and theme config/toggle.

## Config

Product knobs live in `heimdall.config.mjs` at the monorepo root.

- `runtime.heimdallPath` — Pocket Dimension uses `"/"` (site root); package default for embeds is `/heimdall`
- Modules map to `_bmad-output/<tree>/` paths
- API under production: `/dev-api/*`

## v1 pages

Overview · Features · Delivery · Blockers · Questions · Deferred · Docs

**Optional (config):**

- `pages.tests` — in-app Tests page (dogfood Vitest RunnerAdapter)
- `pages.testLevels` — which levels to show (`L1`–`L4`, `tooling`, `L5`); omit = all
- `links.apiDocs` / `links.sample` — external sidebar links

## Maintainers

Private app — not published. Quality gate:

```bash
cd apps/heimdall
bun run check   # typecheck + test + build
```

Root: `bun run build:app:heimdall`

## Planning

Heimdall BMAD SoR lands under `_bmad-output/heimdall/` incrementally (Part 2). Until then, see [`HEIMDALL-PORT-PLAN.md`](../../HEIMDALL-PORT-PLAN.md).
