# Feature Registry — `@pocket-dimension/utils`

Brownfield capability inventory for `shared/utils`. Derived from deep scan 2026-08-31 — see [architecture.md](./architecture.md).

| ID | Name | Screens | Owner | Epic | Status |
| --- | --- | --- | --- | --- | --- |
| F-1 | Base env schema | n/a | Platform | Epic 1 | Live |
| F-2 | validateEnv helper | n/a | Platform | Epic 1 | Live |
| F-3 | Package build & exports | n/a | Platform | Epic 1 | Live |

## Feature details

### F-1 — Base env schema

- **Goal:** Provide a shared Zod base that always includes `NODE_ENV`.
- **Area:** Env
- **Includes:**
  - `baseEnvSchema` with `NODE_ENV` enum defaulting to `development`
- **Deferred:**
  - None currently.
- **See also:**
  - [architecture.md](./architecture.md#baseenvschema)

### F-2 — validateEnv helper

- **Goal:** Merge consumer schemas with the base schema and fail fast on invalid env.
- **Area:** Env
- **Includes:**
  - `validateEnv(source, appEnvSchema, env?)` — logs source, extends base, `parse` throws
  - Defaults to `Bun.env`; accepts explicit string maps
  - Consumer patterns: lazy Proxy (db) vs eager top-level (auth/apps)
- **Deferred:**
  - Result-type API (throws only today)
  - Internal cache of validated env
- **See also:**
  - [architecture.md](./architecture.md#validateenvsource-appenbschema-env)

### F-3 — Package build & exports

- **Goal:** Ship a tiny ESM library apps can import from `dist/`.
- **Area:** Package
- **Includes:**
  - Bun build → `dist/`; `zod` external
  - `exports["."]` types → src, default → dist
  - Scripts: `build`, `clean`, `lint`, `typecheck` (`tsgo`)
- **Deferred:**
  - Automated tests (none today)
- **See also:**
  - [development-guide.md](./development-guide.md)
