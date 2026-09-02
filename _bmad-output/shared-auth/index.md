# shared-auth — BMAD module

**Package:** `@pocket-dimension/auth`  
**Code:** `shared/auth`  
**Heimdall module id:** `shared-auth`  
**Scan:** Deep brownfield, 2026-08-31  
**Type:** library

| Doc | Use |
| --- | --- |
| [project-context.md](./project-context.md) | Agent rules |
| [project-overview.md](./project-overview.md) | Purpose and consumers |
| [architecture.md](./architecture.md) | Better Auth config, emails, env |
| [development-guide.md](./development-guide.md) | Build, secrets, local cookie caveat |
| [source-tree-analysis.md](./source-tree-analysis.md) | File layout |
| [FEATURE-REGISTRY.md](./FEATURE-REGISTRY.md) | Features SoT |

Feature Registry wired in `heimdall.config.mjs`. HTTP boundary is `apps/auth-service` (document when that app module is added). Depends on [`../shared-db/`](../shared-db/) and [`../shared-utils/`](../shared-utils/).
