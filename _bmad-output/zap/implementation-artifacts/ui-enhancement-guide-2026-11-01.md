# Zap · UI enhancement guide

**App:** `apps/zap`  
**Captured:** 2026-11-01 → 2026-11-02 (session pass — catalogue chrome, filters, search, dropdowns, shell nav, theme defaults, track rows, queue dock defaults; then tags/icons, seek, header/dock ink, play tiles, Theme simplify; then Play all / Save toolbar simplify)  
**Purpose:** Durable log of UI/UX decisions so we can later distill a Zap design philosophy / DESIGN.md. Prefer facts + rationale over polish.  
**Philosophy SoR (store):** `/cursor/stores/self/docs/zap-design-system-v1.md` — Prism Pulse + **Catalogue & shell — shipped philosophy**.

---

## How to use this doc later

1. Treat **Changes** as the source of truth for what shipped in this pass.
2. Treat **Emerging principles** as hypotheses — promote into a locked DESIGN.md only after they survive more surfaces (playlists, session, history, admin).
3. Prefer shared primitives (`.zap-dropdown`, `.zap-underline-field`, `ZapSelect` variants) over one-off class stacks when extending the look.

---

## Changes (this pass)

### 1. Theme motion defaults

| Control | Before | After |
| --- | --- | --- |
| Card opacity | 40% | **100%** |
| Animation opacity | 80% | **40%** |
| Animation layer | Behind UI | **On top** |

- **Where:** `apps/zap/src/lib/theme-prefs.ts` (`MOTION_*` defaults + `DEFAULT_THEME_PREFS`).
- **Note:** Existing `localStorage` (`zap.theme.prefs`) keeps prior user choices; defaults apply to fresh sessions only.
- **Intent:** Solid cards, quieter visualizer, visualizer over chrome when animations are on.

---

### 2. Catalogue filters chrome — strip the card shell

- **Removed** the catalogue `zap-filters-panel` wrapper (`rounded-lg border … bg-card p-3`).
- Scope, search, tag filters, and add sit **directly in the page flex flow** (no boxed filter card).
- Playlist-match / bulk-add rows kept as plain text rows (no card-internal `border-t` dividers).
- **Where:** `apps/zap/src/routes/(protected)/catalogue/+page.svelte`.
- **Intent:** Less nested “panel in a panel”; catalogue already has track-host chrome — filters should feel like page controls, not a second card.

---

### 3. Shell nav — compact menu on small screens

- **`sm+`:** Horizontal primary links (Catalogue / Playlists / Sessions [+ Running Jobs]) + settings gear.
- **`< sm`:** Single **menu** trigger (`SettingsMenu` with `includePrimary`) holding primary routes + settings (Connections, History, Admin, Theme, Log out).
- Header stays a **single row** (brand left, control right) instead of stacking brand above links.
- **Where:** `apps/zap/src/routes/(protected)/+layout.svelte`, `SettingsMenu.svelte`.
- **Intent:** Small viewports get one affordance; don’t fight for horizontal space with uppercase nav labels.

---

### 4. Catalogue toolbar layout (scope · filters · search)

**Structure (collapsible / catalogue mode):**

1. **Row A** — plain text controls: library scope select + “Filters” toggle (bottom-aligned).
2. **Row B** — underline search + add action.
3. Filters UI opens in a **popover**, not an inline expanding block.

**Scope select (`ZapSelect` `variant="plain"`):**

- Trigger = **selected label + chevron only** (no `auth-field` box).
- Label casing: **“Your Library”**.
- Styling: `font-mono text-[11px] text-muted-foreground leading-none`.
- List: roomy options (`px-3 py-2`, `text-xs`, min width ~12rem) — compacted once, then restored to non-compact.
- List chrome: `.zap-dropdown` (accent edge only).

**Filters toggle:**

- Same visual language as scope: plain mono label + chevron (no bordered icon button, no sliders icon).
- Opens a **popover** (`role="dialog"`) with `TagQueryEditor` (`layout="stack"`, `compact`).
- Click-outside / Escape closes; outside scope excludes only the Filters **trigger + panel** so opening the scope select closes Filters and can open its own menu.
- Mobile: panel uses `left-0 right-0` against the **full toolbar row** so it doesn’t overflow the viewport; `sm+` can cap width (`sm:w-[min(100%,28rem)]`).
- Dropped persisting `filtersOpen` in `localStorage` (popup open-state is ephemeral).

**Where:** `CatalogueFilters.svelte`, catalogue `+page.svelte`.

**Intent:** Meta controls (scope / filters) read as quiet captions; search is the primary field. Filters are on-demand, not always consuming vertical space.

---

### 5. Search + tag query — underline fields

- Catalogue search uses **`.zap-underline-field`**: transparent fill, no side/top border, **bottom border only**; focus → accent (`--signal`).
- Magnifier icon: **white** (not muted gray) so it reads as chrome, not placeholder.
- Tag query input in `TagQueryEditor` also uses **`.zap-underline-field`** (same grammar as catalogue search).
- **Where:** `app.css` (`.zap-underline-field`), `CatalogueFilters.svelte`, `TagQueryEditor.svelte`.
- **Intent:** Text entry is a writing line, not another boxed control.

---

### 6. Shared dropdown language (app-wide)

Introduced **`.zap-dropdown`** in `design-chrome.css` and applied across Zap menus:

| Surface | Component / location |
| --- | --- |
| Scope / selects | `ZapSelect` listbox |
| Settings / mobile app menu | `SettingsMenu` |
| Catalogue filters popover | `CatalogueFilters` |
| Tag multi-select picker | `TagMultiSelect` |
| Tag “More” menu | `TagQueryEditor` |
| Track overflow menu | `TrackRow` |

**Chrome rules:**

- **No full box border / radius / glow ring.**
- **Single accent edge:** bottom border `1px solid var(--signal)`; when menu opens upward, use top edge (`.is-up`).
- **Hover:** soft white wash — `color-mix(in srgb, #fff 78%, transparent)` with dark text `#12100e` (not washed accent `bg-signal/10`). Keyboard highlight in tag pickers follows the same white/80 idea.

**Intent:** Dropdowns feel like temporary sheets clipped by a signal underline, not floating cards. Hover should flash “paper” (soft white), not tint the whole row coral.

---

### 7. Catalogue track list — no table / row borders

- Catalogue `.zap-track-host`: no outer frame border; transparent background (not a card well).
- Catalogue `.zap-track` rows: no bottom rules.
- Removed Tailwind `divide-y` / suggestion list bottom border on catalogue lists.
- **Scrollbar hidden** on catalogue host (`scrollbar-width: none` + webkit hide); list still scrolls.
- Scoped under `.zap-catalogue` so playlists / history / admin hosts keep framed lists for now.
- **Where:** `design-chrome.css`, `catalogue/+page.svelte`.
- **Intent:** After de-carding the filter shell, the list shouldn’t sit in another heavy box with hairlines between every title.

---

### 8. Catalogue track row density + actions

- **Horizontal padding:** removed (`px-4` gone) so rows align with toolbar edges.
- **Vertical padding:** tightened to **`py-1.5` / `0.375rem`** (tried zero — too tight; restored smaller pad).
- **Tags column:** `sm:items-center` so chips + actions sit vertically centered with the title block.
- **Edit tags:** icon-only ghost button (no label, no border); `aria-label` / `title` kept.
- **Metadata line:** artist · duration only — **no source** (`youtube` / etc.).
- **Delete:** removed from catalogue `TrackRow` usages; admins delete via admin panel.
- **Where:** `TrackRow.svelte`, `design-chrome.css` (catalogue overrides).
- **Intent:** Denser reading list; actions stay quiet; catalogue isn’t an admin console.

---

### 9. Catalogue row hover — accent elements, not wash

- **No row background** wash on catalogue hover (overrides global `.zap-track:hover` fill).
- On hover (non-selected rows):
  - **Title** → signal
  - **Play control** → **icon color** to `--signal` only (ink fill + float shadow stay; **no** accent border / ring on hover — superseded the earlier “accent border” try)
  - **Tag chips** → signal border / text / light fill (when text/chip mode)
- **Selected / current row:** play button already has filled accent bg — **do not** re-style play on row hover when `.is-current`.
- **Where:** `design-chrome.css` (`.zap-catalogue …`), `TrackRow.svelte` (`group` / `group-hover` where needed).
- **Intent:** Hover points at what you’d interact with (title, play glyph, tags), not a whole-row tint.

---

### 10. Catalogue data policy (list contents)

- Browse / search only returns **`ready`** assets — **`unavailable`** songs are hidden from catalogue UI (`CATALOGUE_VISIBLE_STATUSES = ["ready"]`). Admin songs page still lists them.
- **Where:** `apps/zap/src/lib/server/catalogue.ts`.
- **Intent:** Catalogue is for playable music; broken/private sources don’t clutter the shelf.

---

### 11. Queue dock default

- Catalog queue **defaults to docked** at the bottom footer (`docked = true`).
- `localStorage` `zap.queue.docked`: missing key → docked; `"0"` / `"1"` still honor an explicit user choice.
- **Where:** `CatalogQueueDock.svelte`.
- **Intent:** Primary listening chrome lives in the footer unless the user undocks.

---

## Key files

| Area | Path |
| --- | --- |
| Theme defaults | `apps/zap/src/lib/theme-prefs.ts` |
| Shared dropdown + catalogue track CSS | `apps/zap/src/lib/styles/design-chrome.css` |
| Underline input | `apps/zap/src/app.css` (`.zap-underline-field`) |
| Catalogue filters UI | `apps/zap/src/lib/components/CatalogueFilters.svelte` |
| Tag query field | `apps/zap/src/lib/components/TagQueryEditor.svelte` |
| Select primitive | `apps/zap/src/lib/components/ZapSelect.svelte` |
| Settings / mobile menu | `apps/zap/src/lib/components/SettingsMenu.svelte` |
| Track row | `apps/zap/src/lib/components/TrackRow.svelte` |
| Queue dock default | `apps/zap/src/lib/components/CatalogQueueDock.svelte` |
| Queue dock bar (seek hide) | `apps/zap/src/lib/components/CatalogQueueDockBar.svelte` |
| Shell layout | `apps/zap/src/routes/(protected)/+layout.svelte` |
| Catalogue page | `apps/zap/src/routes/(protected)/catalogue/+page.svelte` |
| Catalogue visibility | `apps/zap/src/lib/server/catalogue.ts` |
| Tag icon catalog | `apps/zap/src/lib/tag-icons.ts` |
| Tag icon picker | `apps/zap/src/lib/components/TagIconPicker.svelte` |
| Theme prefs panel | `apps/zap/src/lib/components/ThemePrefsPanel.svelte` |
| Tag icon column | `shared/db` migration `0065_zap_tag_icon.sql` |

---

## Changes (follow-on · 2026-11-02)

### 12. Tag system icons

- DB: `zap.tags.icon` (nullable text) — migration `0065_zap_tag_icon.sql`.
- Curated colorful emoji catalog in `tag-icons.ts` (mood / music / media / anime / classic / eyes / languages·flags / etc.) with keyword search.
- Admin tags: each system tag chip has an **icon slot** (glyph or blank dashed placeholder). Click opens `TagIconPicker` popup — no separate “Icons & emojis” page section.
- Filters / pickers / edit-tags: show **icon + text** when an icon is set.
- **Where:** admin tags UI + server actions, `TrackRow`, `TagQueryEditor`, `TagMultiSelect`, `EditTagsDialog`.
- **Intent:** Icons are attributes of tags, not a parallel taxonomy UI.

### 13. Catalogue tag display prefs (Theme)

| Pref | Values | Default |
| --- | --- | --- |
| Catalogue tags | `text` · `icons` · `both` | **`text`** (text badges) |
| Monochrome icons | on / off | off |

- `data-catalogue-tags` + `data-monochrome-icons` on the document; CSS drives row rendering.
- **Icons-only mode:** plain glyphs — **no chip chrome** (no border/fill/radius wrapper).
- Text / both: keep badge chrome; both = icon inside the chip with the label.
- **Where:** `theme-prefs.ts`, `ThemePrefsPanel.svelte`, `design-chrome.css`, `TrackRow.svelte`.
- **Intent:** Listener chooses density of tag chrome; default stays readable text badges.

### 14. Rectangular seek / range controls

- `.zap-seek`: **rectangular** track (not pill / `rounded-full`).
- Thumb = **vertical rectangle**, not a circle.
- Applies to playback seek, volume, Theme motion sliders.
- Queue dock: seek + time clocks **hidden below `sm`** (space for transport).
- **Intent:** Match the denser catalogue grammar; stop “capsule player” chrome.

### 15. Shell header — flush + signal under-glow

- Header flush to **window edges** (no top/side inset, no rounded corners).
- Dropped bottom hairline rule; presence = soft **signal under-glow** (`box-shadow` / `color-mix` with `--signal`, same family as login card glow).
- Tried a floating inset card header, then reverted to flush — keep glow, lose gaps/radius.
- **Where:** `(protected)/+layout.svelte`, `design-chrome.css`.

### 16. Shared ink chrome surface

| Surface | Fill |
| --- | --- |
| Header | fixed ink `--card` (`#0f0f0f` / `DEFAULT_CARD_SURFACE`) |
| Queue dock + floating queue/devices | same ink |
| Idle track play tile | same ink + light float shadow |
| Page canvas | Theme **page background** preset (independent) |

- Page background may be near-black or **accent-tinted dark**; header/dock **do not** follow page tint.
- Regression: temporarily wired `--card` from page presets → header looked wrong; restored fixed ink and `applyThemePrefs` uses `DEFAULT_CARD_SURFACE`.
- **Intent:** Chrome reads as one continuous shelf; page tint is atmosphere only.

### 17. Track play tile

- Slightly rounded (`~0.35rem`), **borderless**, soft floating shadow.
- Idle: ink fill; hover → **icon only** → `--signal` (fill stays ink; no accent ring).
- Current / playing: solid `--signal` fill + on-accent icon.
- **Where:** `design-chrome.css` (`.zap-play` / catalogue overrides), `TrackRow.svelte`.

### 18. Theme settings simplify

- **Removed** Cards & windows picker — chrome ink is fixed.
- **Removed** gray / light-black / dark-gray page options.
- **Added** dark accent-equivalent page backgrounds (one tint per accent lead).
- Accent leads unchanged (coral / red / purple / pink / white / yellow / green / blue).
- Motion defaults from earlier pass still apply (card 100% · anim 40% · layer on top).
- New prefs: Catalogue tags + Monochrome icons.
- **Where:** `theme-prefs.ts`, `ThemePrefsPanel.svelte`.

### 19. Play all + Save as playlist — one meta row (consistency / less redundancy / simpler UX)

**Intent:** Stop splitting bulk actions into a second caption strip under the toolbar. Match Filters’ quiet mono disclosure language. One control for “play this shelf,” with complexity only when filters make insert position ambiguous.

| Before | After |
| --- | --- |
| Play all + Add all on a helper row under search (only when filtering or playlist-scoped) | **Play all** always on the scope/Filters row above search |
| Separate **Add all to queue** button | Removed — unfiltered Play all appends (`last`); filtered menu covers next / last / replace / shuffle |
| Save as playlist on its own “No playlist uses these tags” row | Quiet caption on the same meta row as Filters / Play all |
| Replace needed a ConfirmDialog after choosing Play all | Filtered menu’s **Replace current queue** is the confirm (shown only if a queue is active) |

**Behavior:**

- **No search/tag filters:** click Play all → `enqueueFiltered(…, "last")` (whole current scope).
- **Filters active:** `.zap-dropdown` menu — Replace (if `queue.active`) · Play next · Play last · Shuffle in queue (`shuffle` = Fisher–Yates then append).
- Exclusive with Filters popover (opening one closes the other).
- API: `BulkEnqueueMode` adds `"shuffle"`; client `enqueueFiltered` accepts it.

**Where:** `catalogue/+page.svelte` (`toolbarExtras`), `CatalogueFilters.svelte` (`toolbarExtras` snippet), `catalog-queue.ts` (`shuffleIds`), `api/catalog-queue/+server.ts`.

### 20. App-wide catalogue grammar rollout (2026-11-02)

**Intent:** Same principles as the catalogue revamp — consistency, less redundancy, simpler chrome — on every Zap surface.

| Area | Change |
| --- | --- |
| Shared CSS | `.zap-filters-panel` transparent; `.zap-track-host` borderless by default (`is-framed` for admin); affordance hover (not row wash); `.zap-transport-btn` / `.zap-transport-play` / `.zap-meta-disclosure` |
| Session library | Play all on Filters meta row (always); drop Add all; filtered menu + shuffle; borderless list; icon enqueue actions |
| Session player / queue / dock | De-card now-playing + queue; ink transport play tiles |
| Playlists / history / home / sessions / jobs | De-card tool stacks; underline search; borderless shelves; quiet disclosures |
| Theme / connections / setup / Discord | Flush preference & connection panels; underline connection search |
| Admin | Framed hosts (`is-framed`); underline filter/search; quieter section chrome |
| Auth | Drop login/sign-up ledes under titles (auth card shell kept) |
| Dialogs / pickers | Underline search in Edit tags + Tag icon picker; TrackListSkeleton transparent |

**Follow-up still open:** playlist detail Play+Queue twin CTAs → single Play-all menu; SettingsMenu → `.zap-menu-item`; remaining boxed primary CTAs on create/follow forms.

---

## Emerging principles (draft — not locked)

Use these as candidates when writing a formal Zap design philosophy:

1. **De-card secondary chrome**  
   Page-level filter/tooling shouldn’t sit in a second `bg-card` frame when the content list already has (or used to have) frame chrome — prefer bare page flow.

2. **Quiet meta, loud primary**  
   Scope / Filters read as small muted mono captions; search (and primary CTAs like Add) carry the weight.

3. **Text + chevron over icon buttons for toggles**  
   Disclosure controls match each other (scope ↔ filters): label, chevron, optional count — no boxed icon-only toggles unless density demands it. Row-level actions can be **ghost icons** (edit tags).

4. **Popovers for optional complexity**  
   Tag query stays out of the permanent layout; open on demand; don’t persist open state across reloads.

5. **One dropdown grammar**  
   All menus share accent-edge + soft-white hover. Don’t invent a second floating-card language per feature.

6. **Responsive: collapse chrome, don’t shrink type into oblivion**  
   Primary nav collapses to a menu on small screens; filter popovers span the toolbar width instead of overflowing from a mid-row anchor.

7. **Underline = inputting; edge = temporary menu**  
   Underline fields for persistent text entry (search + tag query); accent bottom/top edge for ephemeral lists/menus.

8. **Motion defaults favor readability**  
   Opaque cards + quieter / on-top animation: beat visuals shouldn’t punch through UI at the expense of reading track titles.

9. **Exclusive popovers**  
   Opening one overlay (scope select) should dismiss another (filters) via correct outside-click scoping — don’t nest hit-targets so competing menus deadlock.

10. **Casing as product voice**  
    Title-case product labels where they act as proper names (“Your Library”), keep uppercase for section stamps / nav where the system already shouts (CATALOGUE title, shell links).

11. **Hover the affordance, not the slab**  
    List hover should light title / play chrome / tags — not a full-row background wash. Don’t restyle controls that are already in a filled selected state.

12. **Catalogue is a listener shelf**  
    Hide unplayable / admin-only concerns (unavailable rows, delete) from the main catalogue; keep density high and metadata lean (no source type in the subtitle).

13. **Dock-first listening**  
    Queue defaults to the bottom dock; floating is an escape hatch, not the first impression.

14. **Ink chrome, tinted stage**  
    Header, dock, and idle play tiles share fixed ink `#0f0f0f`. Page background may tint with the accent; chrome does not.

15. **Flush header, glow not frame**  
    Presence from soft signal under-glow — not inset cards, not bottom hairlines, not rounded floating bars.

16. **Hover the glyph, not the ring**  
    Play-tile hover tints the icon only; keep ink fill and float shadow. No accent border chase.

17. **Rectangular ranges**  
    Seek / volume / theme sliders use rectangular tracks and vertical-rect thumbs — no pills.

18. **Tags are data; display is preference**  
    Admin attaches icons to tags. Catalogue chooses text / icons / both in Theme. Icons-only never wears chip chrome. Filters stay icon+text for scanability.

19. **Collapse seek before transport on small screens**  
    Dock hides seek + clocks below `sm`; keep play controls usable.

20. **One meta grammar for catalogue tooling**  
    Scope, Filters, Play all, and Save as playlist share the quiet mono caption row above search. Don’t invent a second bulk-action strip with boxed buttons.

21. **Complexity only when the choice matters**  
    Unfiltered Play all has a single default (append). Filtered Play all opens a menu because insert/replace/shuffle is a real choice. Drop redundant twins (Play all + Add all).

22. **Consistency over novelty for disclosures**  
    Play all’s filtered menu uses the same `.zap-dropdown` + exclusive-popover rules as Filters — not a new dialog chrome.

---

## Explicit non-goals (this pass)

- Did not redesign auth screens, playlists page chrome, or admin list frames.
- Did not change boxed `auth-field` globally — underline is opt-in (catalogue search + tag query).
- Did not retarget field-variant `ZapSelect` triggers (admin/history still use boxed triggers); plain variant is the catalogue/toolbar pattern.
- Did not wire a full `_bmad-output/zap` product SoR / FEATURE-REGISTRY — this guide is an implementation artifact only.
- Devices dock default left unchanged (still undocked unless stored).
- Did not restyle session now-playing glass to match catalogue ink header (session still follows Prism Pulse mock glass).
- Did not add custom user-uploaded tag icons — system emoji catalog only.
- Did not change session “Add from library” Play all / Add all strip yet (catalogue-only simplify).

---

## Follow-ups / open questions

- [ ] Apply underline search + plain scope patterns to **session “add from library”** collapsible filters for parity.
- [ ] Port catalogue Play all meta-row + filtered menu (drop Add all) to **session add-from-library** for consistency.
- [ ] Decide whether **field** `ZapSelect` (boxed) should eventually lose the boxed trigger in denser toolbars.
- [ ] Soft-white hover at 78% — validate on light-ish card fills and on-top animation layer; tweak if contrast fails.
- [ ] Promote “Emerging principles” → locked `DESIGN.md` once playlists / history toolbars get the same pass (store philosophy already updated in `zap-design-system-v1.md`).
- [ ] Optional: extract `.zap-plain-disclosure` shared class for scope + Filters triggers to avoid drift.
- [ ] Align `TrackListSkeleton` with borderless / no-horizontal-pad catalogue list.
- [ ] Consider same hover grammar (title / chips, no wash) on playlist track lists.
- [ ] Consider matching rectangular seek + ink dock language on session transport.

---

## Changelog summary (one screen)

- Theme defaults: card 100% · anim 40% · layer on top  
- Catalogue filters: no card shell; plain scope + Filters; filters in popover; mobile-safe width  
- Search + tag query: underline fields; white search icon  
- Dropdowns: shared accent-edge + soft-white hover  
- Shell: hamburger/app menu on small screens  
- Interaction: Filters closes when opening scope select  
- Catalogue list: no host frame / row borders; hidden scrollbar  
- Track rows: tighter pad; ghost edit-tags; no source; no delete; centered tags  
- Row hover: accent title / play **icon** / tags — no wash; play fill stays ink; skip play restyle when selected  
- Data: hide unavailable from catalogue  
- Queue: default docked at bottom  
- Tags: system icons on tags; Theme catalogue display text/icons/both (default text); optional monochrome; icons-only = no chip  
- Seek: rectangular track + vertical thumb; dock seek hidden `< sm`  
- Header: flush edges + signal under-glow; shared ink with dock / play tiles  
- Theme: drop Cards picker + gray pages; accent-tinted dark page backgrounds; fixed ink chrome  
- Play all + Save as playlist on Filters row; always-on Play all; drop Add all; filtered menu (replace / next / last / shuffle)  
- Goal: consistency with Filters, less redundancy, simpler default path  
- App-wide rollout: borderless shelves, de-card tools, underline search, ink transport, session Play all parity, admin `is-framed`
