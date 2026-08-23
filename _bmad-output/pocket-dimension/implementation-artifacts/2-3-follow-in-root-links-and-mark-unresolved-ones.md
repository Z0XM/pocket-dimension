---
story_id: "2.3"
story_key: 2-3-follow-in-root-links-and-mark-unresolved-ones
epic: 2
depends_on: 2-2-read-an-artifact-as-structured-markdown
baseline_commit: d4646b9
---

# Story 2.3: Follow in-root links and mark unresolved ones

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->
<!-- Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As Ubuntu,
I want links inside an Artifact to open the target or show that they cannot,
so that I can move through the BMAD record without silent failures.

## Acceptance Criteria

1. **Given** a rendered Artifact contains a relative link to another file under the BMAD Root  
   **When** I follow it  
   **Then** that Artifact opens in the Reader (FR-5)  
   **And** `resolve-link.ts` maps relative href + source path to an in-root Reader URL  
   **And** the markdown pipeline applies this after sanitize  
   **And** a heading/hash link inside the current Artifact scrolls to that heading when present

2. **Given** a link the Showcase cannot resolve (missing file, outside allow-list, or broken href)  
   **When** the Reader renders it  
   **Then** the link is still visible  
   **And** it is marked unresolved (`{ unresolved: true }`, DESIGN.md `{colors.destructive}`) and still looks like a link (UX-DR4)  
   **And** it does not fail silently and does not navigate outside the allow-list

3. **Given** a `javascript:` or otherwise stripped href  
   **When** sanitize + resolve run  
   **Then** it is not an executable link in the Reader

## Tasks / Subtasks

- [x] Pure `resolve-link` (AC: 1, 2)
  - [x] **NEW** `apps/dashboard/src/lib/catalog/resolve-link.ts` — **no `fs`**
  - [x] API (names flexible; shape must support `{ unresolved: true }`):
    ```ts
    type ResolveLinkInput = {
      href: string;
      sourcePath: string; // posix relative under selected tree (file being rendered)
      tree: TreeId;
      /** Optional pure predicate for missing-file detection; server supplies existsSync-backed fn */
      exists?: (normalizedTreeRelativePath: string) => boolean;
    };

    type ResolveLinkResult =
      | { unresolved: true; reason?: string }
      | { unresolved?: false; href: string; kind: "reader" | "hash" | "external" };
    ```
  - [x] Rules (posix; normalize `\` → `/`):
    - Empty / whitespace href → `{ unresolved: true }`
    - `javascript:` / `data:` / `vbscript:` / other non-allowlisted schemes → `{ unresolved: true }` (defense in depth; sanitize already strips many)
    - Hash-only (`#section`) → `{ kind: "hash", href: "#…" }` (preserve fragment; do **not** mark unresolved when target heading may exist)
    - `http:` / `https:` / `mailto:` (and other rehype-sanitize-allowed absolute schemes) → `{ kind: "external", href }` unchanged
    - Relative / path-like (`./x`, `../x`, `foo/bar.md`, query+hash on relative): resolve against `dirname(sourcePath)`; strip leading `./`; collapse `.` / `..`; if result escapes tree root (starts with `..` or absolute) → `{ unresolved: true }`
    - In-tree target: if `exists` provided and returns false → `{ unresolved: true }` (missing file)
    - In-tree target (exists unknown or true) → Reader URL via `encodePathSegments`: `/docs/{encoded}?tree={tree}` + preserve `#fragment` if present on original href → `{ kind: "reader", href }`
  - [x] Reuse `encodePathSegments` from `$lib/docs-path` (same as Catalog). Never invent a second encoding.
  - [x] Do **not** allow navigation to another BMAD tree via `../` escape. Allow-list = selected tree only for v1.
  - [x] **NEW** `apps/dashboard/src/lib/catalog/resolve-link.test.ts` — goldens for: sibling `.md`, `../` within tree, `../../` escape, missing via `exists`, hash-only, `https://`, `javascript:`, empty, query+hash on relative, directory/run-folder path, Windows-ish `\`, URL-encoded segments

- [x] Wire resolve **after** sanitize in markdown pipeline (AC: 1, 2, 3, NFR-5)
  - [x] **UPDATE** `apps/dashboard/src/lib/server/markdown.ts`
  - [x] Keep order: `remark-parse` → `remark-gfm` → `remark-rehype` → `rehype-sanitize` → **link-resolve transform** → `rehype-stringify`
  - [x] Architecture closure: apply resolve **after** sanitize — never before (rewritten `/docs/...` must not be re-stripped; post-sanitize transform is trusted code we own)
  - [x] Extend API, e.g. `sanitizeMarkdown(source, ctx?: { sourcePath: string; tree: TreeId; exists?: (p: string) => boolean }): string`
  - [x] Post-sanitize HAST walk (`unist-util-visit` or small custom rehype plugin): for each `a` element:
    - No `href` (already stripped, e.g. former `javascript:`) → leave as non-executable `<a>`; do **not** re-add href; optional: leave unmarked (AC3 satisfied by non-executable)
    - Else call `resolveLink`; on `{ unresolved: true }` keep **visible** link text, set `class` / `data-unresolved` for destructive styling, **remove or neutralize href** so click cannot leave allow-list (no `javascript:`; prefer no href + `role="link"` + `aria-disabled="true"` + `title="Unresolved link"`, or `href` omitted). Still looks like a link (underline via CSS).
    - On resolved reader/hash/external → set `href` to result
  - [x] Add dep only if needed: `unist-util-visit` (and types). Prefer not adding a second markdown stack.
  - [x] **Do not** pass `allowDangerousHtml` / weaken sanitize schema for link rewrite

- [x] Heading ids + in-document hash scroll (AC: 1)
  - [x] Today’s pipeline emits `<h1>…</h1>` with **no `id`** (verified on baseline) — hash links cannot scroll until ids exist
  - [x] After sanitize (trusted), assign stable github-ish ids to `h1`–`h6` that lack `id` (simple slug: lowercase, spaces→`-`, strip non `[a-z0-9-]`, uniquify with `-1`, `-2`…). Optional: `rehype-slug` **before** sanitize — if used, either set sanitize `clobberPrefix: ''` carefully **or** rebase `#hash` → `#user-content-hash` after sanitize (rehype-sanitize default clobberPrefix is `user-content-`). Prefer **post-sanitize id assignment without clobber prefix** to keep `#section` hrefs matching — we control that transform.
  - [x] Hash-only links keep `#slug` matching those ids → browser native scroll when present
  - [x] Missing heading: hash link may still be `{ kind: "hash" }` (not file-unresolved); scroll no-ops — acceptable; do not invent a fake heading
  - [x] Optional Reader assist: on mount / navigation, if `location.hash` set, `scrollIntoView` on matching id (covers client navigations). Keep minimal — native `#` often enough if ids exist in HTML

- [x] Pass context from artifact load (AC: 1, 2)
  - [x] **UPDATE** `apps/dashboard/src/lib/server/read-artifact.ts`
  - [x] `loadMarkdownFile` / run-folder primary: call `sanitizeMarkdown(raw, { sourcePath, tree, exists })` — **requires threading `tree: TreeId` into helpers that currently only take `sourcePath`**
  - [x] `exists`: wrap `resolveArtifactPath(tree, path).ok` or `existsSync` under tree realpath — same allow-list discipline as read; never follow escape
  - [x] Preserve YAML/text paths (no link rewrite needed)
  - [x] Logging: still warn relative paths only; never log full bodies

- [x] Unresolved visual (AC: 2, UX-DR4, DESIGN.md)
  - [x] **UPDATE** `markdown-reader.svelte` and/or `app.css`: style unresolved anchors with `{colors.destructive}` (`text-destructive` / `--destructive` `#F87171` already in `app.css`)
  - [x] Selector e.g. `.prose a[data-unresolved="true"]` or `.prose a.unresolved-link` — underline/offset so it still reads as a link; **not** accent violet; **not** a badge/chip overlay
  - [x] Do not restyle all `prose-a` to destructive — only unresolved

- [x] Golden / regression tests (AC: 1–3)
  - [x] **UPDATE** `markdown.test.ts` — keep existing XSS/structure goldens green
  - [x] Add cases with `sanitizeMarkdown(md, ctx)`:
    - Relative sibling → `href` contains `/docs/` + encoded path + `tree=`
    - Escape `../../` → unresolved marker, no outbound path href
    - Missing file (`exists: () => false`) → unresolved, text still present
    - `#heading` with matching `## Heading` → heading has id; link href `#…` matches
    - `javascript:alert(1)` → no `javascript:` in output; not executable
    - `https://example.com` survives as external
  - [x] Run: `cd apps/dashboard && bun test src`

- [x] Preserve Epic 1–2.2 contracts (regression)
  - [x] Catalog path routes `/docs/[...path]?tree=`; Catalog stays mounted
  - [x] Health `GET /health` → `{"status":"ok"}`; port **3011**; no auth/DB; no write APIs
  - [x] `$lib/catalog` stays pure (resolve-link has no `fs`; `exists` is injected)
  - [x] Do **not** implement Story 2.4 empty/Kind EXPERIENCE polish / FR-10 dogfood AC (except unresolved-link marking required here)
  - [x] Do **not** add Search, Delivery parsers, `searchCorpus`, keyboard overlay
  - [x] Tracking file: only `sprint-status-dashboard.yaml` — never rhymes `sprint-status.yaml`
  - [x] Do not edit `apps/pocket/**` or non-dashboard planning trees

- [x] Verify (AC: 1–3)
  - [x] `cd apps/dashboard && bun test src`
  - [x] `cd apps/dashboard && bun run check`
  - [x] Manual: open an Artifact with relative links (or inject a fixture doc); click in-root → Reader navigates with `?tree=` preserved; broken/missing → destructive visible link, no escape; hash → scrolls; hostile `javascript:` inert
  - [x] `curl -sS http://localhost:3011/health` still OK

## Dev Notes

### Scope boundary (critical)

| In scope | Out of scope (later) |
| --- | --- |
| `resolve-link.ts` + tests (pure catalog) | Story 2.4 empty/missing EXPERIENCE polish + FR-10 dogfood matrix |
| Post-sanitize link rewrite in `markdown.ts` | Client-side markdown re-parse / second sanitizer |
| Heading ids for in-doc hash scroll | `/epics/[id]`, `/stories/[id]` Reader reuse (Epic 3) |
| Unresolved destructive styling in Reader | Search overlay, keyboard registry, `searchCorpus` |
| Thread `tree` + `exists` into markdown load | Cross-tree links, write-back, auth, watcher |

### Current pipeline & docs-path (exhaustive — read before coding)

**Baseline commit `d4646b9` (Story 2.2 done).**

| Module | Current behavior | This story |
| --- | --- | --- |
| `src/lib/server/markdown.ts` | Sync unified: parse → gfm → rehype → **sanitize** → stringify. `sanitizeMarkdown(source): string` only. No link rewrite. Headings have **no ids**. | UPDATE — optional ctx; **after sanitize** visit `a`; add heading ids; keep sanitize first |
| `src/lib/server/markdown.test.ts` | 7 goldens: ranks, table, list, emphasis, https keep, script/`javascript:` strip, not raw `<pre>` | UPDATE — add resolve/unresolved/hash cases; keep XSS goldens |
| `src/lib/server/read-artifact.ts` | `resolveArtifactPath` + `loadArtifact`; `.md` → `sanitizeMarkdown(raw)` **without** tree/link ctx; run-folder primary same | UPDATE — pass `{ sourcePath, tree, exists }` into sanitize |
| `src/lib/docs-path.ts` | `encodePathSegments` / `decodePathParam` — Catalog + sibling links | REUSE for Reader URLs from resolve-link |
| `src/lib/components/markdown-reader.svelte` | `{@html html}`; `prose-a:text-foreground`; max 48rem; display title | UPDATE — unresolved destructive CSS only |
| `src/lib/components/docs-catalog.svelte` | Rows → `/docs/{path}?tree=`; active from params | PRESERVE |
| `src/routes/docs/[...path]/+page.*` | Load + render markdown/run-folder/text/error | PRESERVE behavior; HTML gains resolved hrefs |
| `src/lib/catalog/*` | classify / slug / group-by-kind — pure | ADD `resolve-link.ts` (+ test) |
| `src/app.css` | `--destructive: #f87171` already | Optional utility for unresolved; token exists |
| `package.json` | unified + remark-gfm 4.0.1 + rehype-sanitize 6.0.0 + stringify | Optional `unist-util-visit`; no MiniSearch |

**rehype-sanitize protocols (verified):** `href` allows `http`/`https`/`mailto`/… — relative and `#hash` survive without scheme; `javascript:` → `<a>` **with href removed**. Post-sanitize rewrite to `/docs/...?tree=` is safe and required by architecture.

**Silent-failure risk today:** relative `href="../architecture-dashboard.md"` is emitted verbatim into `{@html}` — browser resolves against `/docs/planning-artifacts/...` as a **site** path, not BMAD tree → wrong/404. This story must rewrite to `/docs/{tree-relative}?tree=`.

### Architecture compliance

- `src/lib/catalog/resolve-link.ts` (+ test) — closure item; relative href + source path → in-root Reader URL or `{ unresolved: true }`; pipeline applies **after** sanitize; unresolved class = DESIGN.md destructive — [Source: architecture-dashboard.md — Gap Analysis / Critical Gaps]
- `$lib/catalog` = pure; `$lib/server` = fs + sanitize — inject `exists`, do not import `fs` in resolve-link
- `markdown-reader` still accepts only sanitized HTML + meta — unresolved is HTML attributes/classes, not a new prop contract
- Security: realpath allow-list; never unsanitized `{@html}`; no executable stripped schemes — [Source: NFR-5]
- Performance: link walk is O(links) on already-parsed tree; must not make normal Story open multi-second — [Source: NFR-3]
- Named absences: Sample World, write-back, auth, watcher, MiniSearch

### Library / framework requirements

- Stack unchanged: Svelte 5, SvelteKit 2 (`^2.49.1`), Bun, Tailwind 4, Fira Code, existing remark/rehype set
- May add: `unist-util-visit` (HAST walk). Optional `rehype-slug` only if post-sanitize id helper is insufficient — prefer zero new markdown frameworks
- Do **not** add isomorphic-dompurify alongside unified unless falling back entirely
- Tests: `bun:test`; `"test": "bun test src"`
- Build Reader URLs with `URL` + `searchParams` so `tree` is never dropped; put hash in `url.hash`

### Project Structure Notes

```
apps/dashboard/src/
  lib/
    docs-path.ts                      # REUSE encodePathSegments
    catalog/
      resolve-link.ts                 # NEW — pure
      resolve-link.test.ts            # NEW
      classify.ts / slug.ts / …       # PRESERVE
    server/
      markdown.ts                     # UPDATE — post-sanitize resolve + heading ids
      markdown.test.ts                # UPDATE
      read-artifact.ts                # UPDATE — pass tree + exists into sanitize
      bmad-root.ts / read-tree.ts     # PRESERVE
    components/
      markdown-reader.svelte          # UPDATE — unresolved destructive styles
      docs-catalog.svelte             # PRESERVE
  routes/docs/[...path]/             # PRESERVE route contract
```

Conflict note: architecture source-tree block originally omitted `resolve-link.ts`; validation **closures** require `src/lib/catalog/resolve-link.ts` — follow the closure.

Conflict note: Kind union has no `'feature'` — ignore any stale architecture Naming Patterns that list it.

Conflict note: rhymes implementation-artifacts include unrelated `2-3-expose-direct-publish-…` files — **this** story file is dashboard-only: `2-3-follow-in-root-links-and-mark-unresolved-ones.md`. Do not edit rhymes stories or `sprint-status.yaml`.

### Previous story intelligence (2.2)

- Reader + Catalog mount via `docs/+layout.svelte`; selection is real `/docs/[...path]?tree=` (2.1 `?artifact=` seam removed)
- `sanitizeMarkdown` is sync `processSync`; XSS goldens already assert no `javascript:`
- `read-artifact` DTO: `markdown` | `run-folder` | `text` | `error` — keep shapes; only HTML contents change
- Run-folder primary uses same sanitize path — must get link rewrite too (pass primary `sourcePath` like `…/prd.md`)
- Explicitly deferred in 2.2: `resolve-link.ts`, unresolved CSS, heading scroll — **own them here**
- 38 tests passing after 2.2; keep classify/slug/bmad-root/nav/markdown goldens green
- Tracking: `sprint-status-dashboard.yaml` only

### Git intelligence

Recent on `cursor/dashboard-epic-1-66a2`:

- `d4646b9` — story 2.2 sanitized Reader, `markdown.ts`, `read-artifact.ts`, path routes, `docs-path.ts`
- `683ea40` — story 2.1 Kind-grouped Catalog
- `ed7442d` / `ca51c29` / `fcc8d37` — Overview, trees, chrome

Implement atop 2.2; do not re-scaffold Reader or reopen Catalog encoding.

### Latest tech information

- Pipeline: sanitize **then** trusted link rewrite (architecture + rehype-sanitize guidance: everything after sanitize must be trusted)
- Default sanitize `clobberPrefix: 'user-content-'` only matters if headings get ids **through** sanitize; post-sanitize id assignment avoids clobber mismatch
- Relative hrefs are kept by default schema; absolute non-http schemes dropped — assert in tests
- Prefer HAST visit over regex on HTML strings (fragile with attributes/order)

### Testing requirements

Automated:

```bash
cd apps/dashboard
bun test src          # resolve-link + markdown link/XSS goldens; prior suites green
bun run check
```

Manual:

```bash
bun run dev:app:dashboard
# Open a markdown Artifact under ?tree=pocket-dimension
# Follow a rewritten in-root relative link → /docs/…?tree=pocket-dimension loads target
# Broken/missing relative → visible destructive link; click does not leave allow-list
# #heading → scrolls when heading exists
# Confirm javascript: fixture remains non-executable
curl -sS http://localhost:3011/health
```

Fail if: resolve runs **before** sanitize; unresolved silently omitted; escape `../` becomes a working external/site navigation; `{@html}` of unsanitized markdown; `fs` inside `$lib/catalog/resolve-link.ts`; Catalog unmounts; 2.4 empty polish drive-by; rhymes `sprint-status.yaml` edited.

### Anti-patterns (do not)

- Resolving links before `rehype-sanitize`
- Putting `fs` / `realpath` in `$lib/catalog`
- Re-introducing `javascript:` for “disabled” links
- Marking all external `https:` links unresolved
- Softening allow-list to follow cross-tree `../` into sibling BMAD trees
- Regex-replacing markdown source links instead of HAST post-process
- Tinted Reader / filled violet unresolved “pills”
- Implementing 2.4 empty-state matrix “while here”
- Editing rhymes sprint status or pocket app

### Empty / error copy (unchanged — 2.4 owns polish)

Unresolved links: no modal, no “Oops!”. Visual = destructive + still link-like. Missing Artifact page copy stays “Unreadable Artifact.” from 2.2.

### References

- [Source: planning-artifacts/epics-dashboard.md — Story 2.3, Epic 2, FR-5, NFR-5, UX-DR4]
- [Source: planning-artifacts/architecture-dashboard.md — resolve-link.ts closure; after sanitize; catalog pure]
- [Source: planning-artifacts/ux-designs/ux-dashboard-2026-08-23/DESIGN.md — unresolved-link → destructive #F87171; still looks like a link]
- [Source: planning-artifacts/ux-designs/ux-dashboard-2026-08-23/EXPERIENCE.md — Docs rail + Reader]
- [Source: planning-artifacts/prds/prd-dashboard-2026-08-23/prd.md — FR-5 Follow in-document links]
- [Source: implementation-artifacts/2-2-read-an-artifact-as-structured-markdown.md — pipeline baseline; deferred resolve-link]
- [Source: apps/dashboard/src/lib/server/markdown.ts — UPDATE baseline]
- [Source: apps/dashboard/src/lib/server/read-artifact.ts — UPDATE baseline]
- [Source: apps/dashboard/src/lib/docs-path.ts — encodePathSegments]
- [Source: apps/dashboard/src/lib/components/markdown-reader.svelte — UPDATE styling]
- [Source: apps/dashboard/src/app.css — --destructive token]

## Dev Agent Record

### Agent Model Used

Composer

### Debug Log References

### Completion Notes List

- Added pure `resolve-link.ts` mapping relative hrefs to `/docs/...?tree=` Reader URLs, hash links, externals, or `{ unresolved: true }`.
- Extended `sanitizeMarkdown` with post-sanitize HAST walk: heading id assignment, link resolve via injected `exists`, unresolved anchors stripped of href with destructive styling hooks.
- Threaded `tree` + `exists` from `read-artifact.ts` into markdown load for `.md` and run-folder primary content.
- Styled unresolved links in Reader (`text-destructive`, underline); optional hash scroll on mount.
- 61 tests pass; `bun run check` clean.

### File List

- apps/dashboard/package.json
- apps/dashboard/src/lib/catalog/resolve-link.ts
- apps/dashboard/src/lib/catalog/resolve-link.test.ts
- apps/dashboard/src/lib/server/markdown.ts
- apps/dashboard/src/lib/server/markdown.test.ts
- apps/dashboard/src/lib/server/read-artifact.ts
- apps/dashboard/src/lib/components/markdown-reader.svelte
- apps/dashboard/src/app.css
- _bmad-output/pocket-dimension/implementation-artifacts/2-3-follow-in-root-links-and-mark-unresolved-ones.md
- _bmad-output/pocket-dimension/implementation-artifacts/sprint-status-dashboard.yaml

## Change Log

- 2026-08-23: Story 2.3 context created (ready-for-dev) — in-root `resolve-link` after sanitize, unresolved destructive marking, heading hash scroll; 2.4 polish explicitly out of scope.
- 2026-08-23: Story 2.3 implemented — resolve-link, post-sanitize pipeline, heading ids, unresolved styling; tests green.
