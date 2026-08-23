# Addendum — dashboard PRD

User-contributed and inferred technical/UX depth. Not requirements language. Downstream UX and architecture own the decisions here.

## Visual tokens (Ubuntu, 2026-08-23)

Locked unless Ubuntu changes them:

- Background: black, or a shade of black
- Accent: a shade of purple or violet
- Tone: simple and minimal
- Components: shadcn
- Font: Fira Code

Suggested (not confirmed) pairing for UX/DESIGN.md:

- Page: near-black (`#0a0a0a`–`#111111`), not pure void if contrast for chrome suffers
- Surface / Catalog: one step lighter than page
- Accent: violet that still reads on black (avoid neon)
- Text: high-contrast off-white; muted secondary for paths and meta
- Radius and density: match existing shadcn usage in sibling SvelteKit apps; do not invent a second component language

## Implementation notes (inferred — architecture owns this)

These are not PRD requirements. They match how this monorepo already ships standalone web apps.

- New package/app named `dashboard`, likely `apps/dashboard`, SvelteKit + Tailwind + shadcn/bits-ui like pocket / markitdown
- Standalone: no Better Auth, no PostgreSQL
- Next free local port after documented apps: **3011** (3010 is zeo-music-worker)
- Read BMAD from repo `_bmad-output/` at runtime (dev) or a configured BMAD Root path
- Catalog allow-list: Current BMAD Trees named in `_bmad-output/README.md` (`pocket-dimension`, `zeo`, `chhan-chhan` as of 2026-08-23). `_bmad-output/rhymes/` is already gone from disk and git; do not resurrect it
- Search: architecture picks the index (in-memory scan is enough at current corpus size). Must meet FR-12 (full text, hits with snippet, open in Reader)
- Deploy from repository root if it ever deploys, per `DEPLOY.md`

## Landscape (Discovery research, 2026-08-23)

Comparables in “markdown in git as the PM record” are mostly **editors and boards**, not Showcases:

- git-prodman — YAML/markdown PM files + bundled web editor, kanban, AI query
- agilemarkdown / brainfile — CLI + TUI + MCP over markdown stories
- DevStories — VS Code tree for themes/epics/stories

**dashboard v1** is the opposite cut: read-only Showcase of an existing BMAD tree. Do not take kanban, edit, or MCP as v1 scope just because neighbors have them. A future public “present your BMAD” product would re-enter via Coaching path.

## Inspiration — SIS Dev Dashboard (`dev` branch)

Source inspected 2026-08-23 at `/home/z0xm/sales-incentives-service` **branch `dev`** (not `main`): `packages/dev-dashboard`.

Nav on that app: Overview, Features, Epics & Stories (`/delivery` with kanban / table / timeline), Blockers, Questions, Deferred, Tests, Data (Sample World), Docs, plus an API link.

**Take for pocket-dimension dashboard:** Overview (thin), Features, Delivery board + table, process Timeline, Tests catalog, Docs + Reader, Search palette (⌘K and `/`).

**Skip:** Sample World / Data / fixture browse / sample seed UI.

**Wanted later (Ubuntu 2026-08-23, not v1):** Blockers, Questions, Deferred pages; in-dashboard test runner; API docs nav when a catalog exists; Pocket hub tile.

**Never:** Sample World / Data / fixture browse. SIS “Dev War Room” visual language (we keep black / violet / Fira Code).

## Future public product (explicitly deferred)

Ubuntu: if **dashboard** is later published so others can present their BMAD apps, use Coaching path and full BMAD (new or updated PRD, UX, architecture, epics). v1 must not pretend that product exists. Cheap future-friendly choices (configable BMAD Root, no baked-in Pocket Dimension copy) are welcome in architecture; multi-tenant hosting is not.
