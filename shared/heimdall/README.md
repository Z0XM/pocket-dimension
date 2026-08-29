# @pocket-dimension/heimdall

Repo-agnostic BMAD / docs **War Room** (SPA + CLI). Private workspace package in Pocket Dimension (`shared/heimdall`).

## Install

Workspace dependency (already in this monorepo):

```bash
bun install
```

## Quick start (standalone)

```bash
# from monorepo root:
bun run heimdall init
bun run heimdall doctor
bun run heimdall dev
```

Or from the package:

```bash
cd shared/heimdall
bun run heimdall doctor
bun run heimdall dev
```

Open the printed UI URL (default `http://127.0.0.1:5174/heimdall/`).

## Authoring

See [docs/AUTHORING.md](./docs/AUTHORING.md) for Soft-empty, doctor, Features/Delivery layout (flat and Modules modes), and theme config/toggle.

## Embed (Fastify)

```ts
import { registerHeimdall } from "@pocket-dimension/heimdall/host";

await registerHeimdall(app, {
  mountPath: "/heimdall",
  basePath: "/heimdall", // or host-joined public prefix
});
```

## Config

Product knobs live in `heimdall.config.ts` / `.mjs` at the consumer repo root.

- `runtime.heimdallPath` default `/heimdall`
- Effective public base: `runtime.basePath`, or `registerHeimdall({ basePath })`, or optional `runtime.basePathFromEnv` (**consumer-chosen** env name — Heimdall never hardcodes `APP_BASE_PATH`)

## v1 pages

Overview · Features · Delivery · Blockers · Questions · Deferred · Docs

**Optional (config):**

- `pages.tests` — in-app Tests page (host RunnerAdapter for runs)
- `pages.testLevels` — which levels to show (`L1`–`L4`, `tooling`, `L5`); omit = all
- `links.apiDocs` / `links.sample` — external sidebar links (Sample UI stays host-owned; no Sample Mode in Heimdall)

## Maintainers

This package is **not published**. Use workspace scripts:

```bash
cd shared/heimdall
bun run check   # typecheck + test + build
```

## Planning

Heimdall BMAD SoR will live under `_bmad-output/heimdall/` (Part 2 of the port). Until then, see the temporary [`HEIMDALL-PORT-PLAN.md`](../../HEIMDALL-PORT-PLAN.md).
