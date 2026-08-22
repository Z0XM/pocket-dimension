# BMAD output (multi-app monorepo)

Pocket Dimension hosts several apps. Each app that uses BMAD Method gets its **own** tree under `_bmad-output/<app>/`. Do not mix artifacts across apps.

## App map

| App | Code path | BMAD output root | Default in `_bmad/bmm/config.yaml`? |
| --- | --- | --- | --- |
| rhymes | `apps/rhymes` | `_bmad-output/rhymes/` | **Yes** (`project_name: rhymes`) |
| zeo | `apps/zeo` | `_bmad-output/zeo/` | No |
| chhan-chhan | `apps/chhan-chhan` | `_bmad-output/chhan-chhan/` | No |

Typical layout per app:

```
_bmad-output/<app>/
  project-context.md              # AI rules for this app
  planning-artifacts/             # PRD, architecture, UX, brownfield docs, …
  implementation-artifacts/       # specs, stories, deferred-work, sprint-status
```

## Switching the active BMAD project

[`_bmad/bmm/config.yaml`](../_bmad/bmm/config.yaml) currently defaults to **rhymes**. When working on another app, temporarily point these keys at that app (then restore rhymes when done):

- `project_name`
- `output_folder` → `_bmad-output/<app>`
- `planning_artifacts` → `{project-root}/_bmad-output/<app>/planning-artifacts`
- `implementation_artifacts` → `{project-root}/_bmad-output/<app>/implementation-artifacts`

Prefer a personal override file (e.g. `_bmad/bmm/config.user.yaml` if used) over committing a permanent switch of the shared default.

**Rule:** Never write app-specific specs, deferred-work, or sprint status into another app’s folder. Quick-dev / one-shot specs for chhan-chhan belong under `_bmad-output/chhan-chhan/implementation-artifacts/`.

## Chhan Chhan agents

Load `_bmad-output/chhan-chhan/project-context.md` when implementing finance/import/Control features. Living operational docs also live in-app: `apps/chhan-chhan/IMPORT.md`, `FUTURE-TODO.md`, `DEPLOY.md`.
