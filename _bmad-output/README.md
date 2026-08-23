# BMAD output

Default BMAD project is the **Pocket Dimension monorepo**. All new planning, stories, and brownfield documentation go under `_bmad-output/pocket-dimension/` unless you are working in an existing app-specific tree.

## Layout

```
_bmad-output/
  pocket-dimension/                 # default — monorepo + rhymes rework
    project-context.md
    planning-artifacts/             # PRDs, architecture, UX, epics
    implementation-artifacts/       # stories, sprint-status
  zeo/                              # existing zeo-only artifacts
  chhan-chhan/                      # existing chhan-chhan-only artifacts
```

Do **not** write BMAD artifacts to a repo-root `docs/` folder.

## App map

| App | Code path | Where its BMAD artifacts live |
| --- | --- | --- |
| monorepo / rhymes rework | repo root, `apps/rhymes` | `_bmad-output/pocket-dimension/` (default) |
| zeo | `apps/zeo` | `_bmad-output/zeo/` |
| chhan-chhan | `apps/chhan-chhan` | `_bmad-output/chhan-chhan/` |

When implementing **zeo** or **chhan-chhan** features, load that app’s `project-context.md` and keep new specs in that app’s tree. Do not drop those specs into `pocket-dimension/` unless the work is actually monorepo-wide.

## Switching away from the default

[`_bmad/bmm/config.yaml`](../_bmad/bmm/config.yaml) and [`_bmad/custom/config.toml`](../_bmad/custom/config.toml) default to **pocket-dimension**. For a one-off app-only workflow, temporarily point `planning_artifacts` / `implementation_artifacts` at `_bmad-output/<app>/`, then restore the default.

## Chhan Chhan agents

Load `_bmad-output/chhan-chhan/project-context.md` when implementing finance/import/Control features. Living operational docs also live in-app: `apps/chhan-chhan/IMPORT.md`, `FUTURE-TODO.md`, `DEPLOY.md`.
