# Contribution Guide

There is no root `CONTRIBUTING.md`. Conventions inferred from the repo:

- **Package manager:** Bun 1.3.5 workspaces + Turbo
- **Format:** Prettier (root `format` / `format:check`; per-package `lint` is prettier-check)
- **Types:** `bun run typecheck` where scripts exist
- **Shared packages:** build `dist/` before running apps
- **Schema changes:** only in `shared/db`, then generate + migrate
- **Deploy:** from repo root; see `DEPLOY.md`
- **BMAD:** default artifacts in `_bmad-output/pocket-dimension/`; do not put chhan-chhan or zeo-only specs here unless the work is monorepo-wide
- **Secrets:** never commit `.env`

Changesets exist (`.changeset/`) for versioning workspace packages.
