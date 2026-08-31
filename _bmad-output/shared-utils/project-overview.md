# Project Overview — `@pocket-dimension/utils`

Tiny shared Zod environment helper used by apps and sibling packages.

| Field | Value |
| --- | --- |
| Type | library |
| Source | `shared/utils/src/index.ts` (single file) |
| Runtime dep | `zod` ^4.2.1 |
| Build | Bun ESM → `dist/`; zod external |

## Consumers

**Direct imports:** `shared/db`, `shared/auth`, `apps/auth-service`, `apps/zeo`, `apps/markitdown`, `apps/pocket` (and workspace dep on watchlist/auth-service).

**Workspace dependency also declared by:** `shared/db`, `shared/auth`, `apps/zeo`, `apps/pocket`, `apps/markitdown`, `apps/watchlist`, `apps/auth-service`.

Some auth-backed apps rely transitively via db/auth without importing utils directly.
