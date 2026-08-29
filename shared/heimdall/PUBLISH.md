# `@pocket-dimension/heimdall` — not published

This is a **private workspace package** under `shared/heimdall`. It is not published to npm or any private registry.

Use it via the Bun workspace:

```bash
# from monorepo root
bun install
bun run heimdall doctor
bun run heimdall dev
```

Local quality gate:

```bash
cd shared/heimdall
bun run check   # typecheck + test + build
```
