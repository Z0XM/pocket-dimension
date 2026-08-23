# rhymes

Standalone SvelteKit literary reader (port **3003**). No auth, no shared database. Content is a markdown corpus under `src/assets/rhymes/`.

A brownfield rework (DB-backed authoring, memberships) is planned in [`_bmad-output/pocket-dimension/`](../../_bmad-output/pocket-dimension/index.md).

## Run

From the monorepo root (after `bun install`):

```bash
bun run dev:app:rhymes
```

Production: see [DEPLOY.md](./DEPLOY.md).
