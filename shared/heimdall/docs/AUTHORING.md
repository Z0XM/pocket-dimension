# Heimdall authoring guide

Product guidance for maintaining BMAD layout in any repo that uses `@pocket-dimension/heimdall`. This guide lives inside the package so consumers find it in the workspace — you do not need monorepo-specific convention docs to get started.

**Audience:** Authors and agents who configure Heimdall, place BMAD artifacts, and interpret Soft-empty surfaces.

---

## 1. Quick start — init → doctor → dev

Run these from your **consumer repo root** after installing the workspace package:

```bash
bun run heimdall init      # write starter heimdall.config.ts
bun run heimdall doctor    # check configured paths (informational)
bun run heimdall dev       # start API + Vite War Room
```

| Command | What it does | When to run |
| --- | --- | --- |
| `init [--force]` | Writes `heimdall.config.ts` with sensible defaults. Refuses to overwrite unless `--force`. | First-time setup or after adding Heimdall to a repo. |
| `doctor` | Lists configured paths and marks **MISSING** ones as warnings. Always exits 0 — warnings are informational, not ship-blockers. | Before `dev`, after moving BMAD files, or when a War Room page looks empty. |
| `dev` | Starts the local API and UI (default UI `http://127.0.0.1:5174/heimdall/`). | Day-to-day authoring and review. |
| `build` | Builds the SPA (`vite build`). | Host embed workflows. |

**Embed (Fastify):** use `registerHeimdall` from `@pocket-dimension/heimdall/host` with your mount and effective public base — see package `README.md`.

> **Pocket Dimension dogfood:** monorepo root scripts `bun run heimdall doctor` / `bun run heimdall dev` call `shared/heimdall/bin/heimdall.cjs`. Alternate: `cd shared/heimdall && node ./bin/heimdall.cjs doctor` / `dev`.

---

## 2. Config is the product contract

All product knobs live in **`heimdall.config.ts`**, **`heimdall.config.mjs`**, or **`heimdall.config.js`** at the consumer repo root (the CLI walks up from the current directory to find it).

- **Paths, modules, pages, links, branding** — configured in that file, not via Heimdall-specific environment variables.
- **Effective public base URL** — set via `runtime.basePath`, `registerHeimdall({ basePath })`, or optional `runtime.basePathFromEnv` where **you** choose the env var name. Heimdall never hardcodes `APP_BASE_PATH`.
- **Default mount segment** — `runtime.heimdallPath` defaults to `/heimdall`.

Treat the config file as the contract between your repo layout and what Heimdall loads. When a configured path is missing or unparsable, Heimdall **Soft-empties** the affected UI surface instead of crashing.

---

## 3. Theme (dark default, optional light)

Heimdall defaults to **dark**. Fresh installs with no stored preference and no `branding.defaultTheme` in config use dark mode.

Hosts can set the default and let operators override it in the War Room chrome:

1. **Config default** — `branding.defaultTheme`: `"dark"` or `"light"`. Omit or leave unset → **`"dark"`**.
2. **UI toggle** — the sticky header exposes a **Theme** control (sun/moon icon). Operators can switch without editing config; the choice persists in `localStorage`.

**Storage key:** `${runtime.uiStoragePrefix}-theme`. The prefix defaults to `"heimdall"`, so the default key is **`heimdall-theme`**. A valid stored value (`"dark"` or `"light"`) overrides the config default. Clearing that key (or removing invalid values) falls back to config, then to dark.

**Resolution order:**

1. Valid stored preference in `localStorage`
2. `branding.defaultTheme` from config
3. `"dark"`

**No OS auto-follow:** Heimdall does **not** listen to `prefers-color-scheme` or follow the operating-system appearance. Theme changes only via config default, the UI toggle, or clearing storage — never automatic switching when the OS theme changes.

Theme applies on the document root via `data-theme` (and `color-scheme`); the SPA does not remount when switching.

Example:

```ts
export default defineConfig({
  branding: {
    subtitle: "My War Room",
    defaultTheme: "light", // omit → dark
  },
  // runtime.uiStoragePrefix defaults to "heimdall" → localStorage key "heimdall-theme"
});
```

---

## 4. Soft-empty and doctor tone

**Soft-empty:** missing or mismatched paths produce empty War Room sections (Features, Delivery, Docs, etc.) — not errors, not stack traces. Parsers that do not match file shape skip gracefully.

**Doctor is informational:**

- Each configured path shows **OK** or **MISSING**.
- Missing optional paths emit **warnings**, framed as Soft-empty expectations — not “broken” or “fix required before ship.”
- Summary when warnings exist: *“War Room will soft-empty affected surfaces (not a crash).”*
- `doctor` always returns exit code **0**. It does not block CI or release by itself.

**Never tell authors that optional MISSING paths are ship-blockers.** Use doctor to learn which surfaces will be empty, then either add content or remove/omit the path from config if you intentionally do not use that surface.

---

## 5. Structuring BMAD for Features & Delivery

Heimdall supports two layout modes. Both use the same config schema; the difference is whether you declare explicit **Modules**.

### Flat mode (single scope)

When `modules` is omitted or empty, top-level `paths.*` form one implicit Module (`id: "default"`). All planning paths resolve relative to `repoRoot`.

Typical flat layout:

- **BMAD source of record (SoR)** — usually under `docs/` and/or `_bmad-output/` depending on your BMAD Method setup.
- **Feature Registry (FR)** — when present and parseable at `paths.featureRegistry`, it is the **sole Features authority** for that scope.
- **Delivery (epics/stories)** — from `paths.epics[]` with a built-in parser (`numeric` or `bmad-output`).
- **Shared runtime paths** — `docsRoot`, `projectContext`, `implementationDir`, `sprintStatus`, optional `docs.extraRoots`.

Use flat mode for a single product or a repo with one BMAD planning tree.

### Modules mode (multiple scopes)

When `modules[]` is non-empty, each entry is a **durable registered scope** — not necessarily an npm package. Each Module has:

- `id` — stable key (used in API/UI).
- `label` — display name.
- `basePath` — repo-root-relative BMAD **SoR root** for that Module.
- `paths` — optional overrides for planning artifacts **relative to `basePath`**:
  - `featureRegistry` — Features SoT for this Module.
  - `epics[]` — Delivery sources (`path` + `parser`).
  - Optional indexes: `intakeIndex`, `deferredIndex`, `externalGaps`.

**Features** for a Module come from its configured `featureRegistry` when present/parseable (respect `synthesizeFeaturesWhenRegistryMissing` if you disable synthesis). In Modules **view-all**, the Features page nests Project areas under each Enabled Module; a single selected Module (or flat config) keeps a flat area list.

**Delivery** for a Module comes from its configured `epics[]`.

Optional **`modules[].idPrefix`** (e.g. `"H"`, `"SQL"`) prefixes epic/story **labels in the UI** (`H1`, `SQL1.1`) without renaming BMAD docs. Omit it to keep bare `1` / `1.1`.

Shared paths (`docsRoot`, sprint status, implementation dir, etc.) remain at the top level and apply repo-wide.

**What are not peer Modules:** nested tracks, initiatives, archive folders, or organizational groupings inside a Module's SoR. Register only durable scopes you want as first-class War Room modules. Initiatives/tracks/archive stay **inside** a Module's planning tree — they are not separate Module entries.

---

## 6. Feature Registry expectations (FR-1)

When a Feature Registry file exists at the configured path and parses successfully:

- It is the **Features source of truth** for that scope (flat default or Module).
- Do **not** maintain a second FR copy under durable `docs/` or elsewhere.
- Hubs and index pages under `docs/` may **link** to the SoR FR — they must not duplicate feature rows as a competing authority.

When FR is missing or empty:

- The Features page Soft-empties (or uses synthesis only if `synthesizeFeaturesWhenRegistryMissing: true` — default in starter config).
- Doctor reports **MISSING** for the configured path; that is informational.

**Forbidden:** dual-authoring the same features in FR and a parallel `docs/` registry.

**Allowed:** thin navigation docs that point readers to the SoR path configured in `heimdall.config.*`.

---

## 7. Optional indexes (only when content exists)

These paths are **optional**. Configure them in `paths.*` (flat) or `modules[].paths.*` (Modules) **only when you have real content**:

| Config key | Typical file | War Room use |
| --- | --- | --- |
| `intakeIndex` | e.g. `INTAKE-INDEX.md` | Intake / inbound work |
| `deferredIndex` | e.g. `DEFERRED-INDEX.md` | Deferred items |
| `externalGaps` | e.g. `EXTERNAL-MODULE-REFERENCE.md` | External dependencies / gaps |

**Do not create empty placeholder files** just to satisfy config. Omit the key entirely until content exists. When omitted, Heimdall does not expect the file and doctor does not warn about it.

When configured and missing, doctor warns and the related surface Soft-empties — same informational tone as other optional paths.

---

## 8. Troubleshooting Soft-empty

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| Features page empty | FR path wrong, file missing, or unparsable | Run `doctor`; fix `featureRegistry` path or add/parse FR at SoR. |
| Delivery empty | No `epics[]` entry, wrong parser, or epics file missing | Confirm `parser` is `numeric` or `bmad-output` for your file shape; fix path under Module `basePath` or flat `paths`. |
| Docs browser sparse | `docsRoot` or `extraRoots` point at empty dirs | Add docs or adjust roots in config. |
| Module missing entirely | `enabled: false` or not listed in `modules[]` | Enable/register the Module in config. |
| Doctor shows many MISSING | Fresh repo or paths not authored yet | Expected for greenfield — add artifacts or remove unused path keys from config. |
| Wrong scope in Modules mode | `basePath` does not match where BMAD files live | Align each Module's `basePath` with its SoR directory. |
| `heimdall dev` / `build` cannot find `vite` | Workspace/`file:` layout (vite not nested under the package folder) | Heimdall resolves vite via Node (`resolveViteBin`). Reinstall so `@pocket-dimension/heimdall`'s `vite` dependency is present; do not hardcode `node_modules/vite` paths in wrappers. |
| Vite ESM errors for `style-to-js` / markdown deps under `file:` | Consumer store serves transitive CJS via `@fs` without interop | Shipped `vite.config.ts` pre-bundles `react-markdown` / `style-to-js` chain and allows `node_modules` under the consumer repo. Restart `heimdall dev` after upgrade. |

**Remember:** Soft-empty is a product behavior, not a failure. Doctor tells you *which* surfaces will be empty so you can fix layout or config deliberately.

---

## See also

- Package `README.md` — install, embed, workspace usage.
- `heimdall.config.ts` — generated by `heimdall init`; authoritative path defaults for flat mode.
- BMAD Method artifacts — typically under `_bmad-output/` when using BMAD workflows.
