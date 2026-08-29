# `@pocket-dimension/heimdall` — not published

This is a **private app** under `apps/heimdall`. It is not published to npm or any private registry.

Use it via the Bun workspace:

```bash
# from monorepo root
bun install
bun run heimdall doctor
bun run heimdall dev
# or
bun run dev:app:heimdall
```

Local quality gate:

```bash
cd apps/heimdall
bun run check   # typecheck + test + build
```
