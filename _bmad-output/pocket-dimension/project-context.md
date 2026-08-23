# Pocket Dimension — Project Context (for AI agents)

**Product:** Personal monorepo of apps sharing Better Auth, Drizzle/PostgreSQL 18, and Bun + Turbo.  
**BMAD default:** `_bmad-output/pocket-dimension/`  
**Code:** `apps/*`, `shared/{auth,db,utils}`

## Monorepo rules

- Deploy auth-backed apps from the **repository root**, not `apps/<app>`. See root `DEPLOY.md`.
- Build `@pocket-dimension/{auth,db,utils}` (`dist/`) before running or testing apps.
- PostgreSQL **18+** is required (`uuidv7`). Schemas are named (`auth`, `watchlist`, `howwasyourday`, `chhanchhan`, `meviayou`, `zeo`), not `public`.
- `BETTER_AUTH_SECRET` must match across `auth-service` and every frontend. `RESEND_API_KEY` must be non-empty or auth-service crashes at module load.
- Better Auth cookies use `secure: true` / `sameSite: "none"`. Sessions may not persist on plain `http://localhost`.
- Do not write BMAD artifacts to a repo-root `docs/` folder. Knowledge lives here.

## Apps

| App | Path | Port | Auth/DB |
| --- | --- | --- | --- |
| auth-service | `apps/auth-service` | 5001 | owns auth |
| watchlist | `apps/watchlist` | 3002 | yes |
| rhymes | `apps/rhymes` | 3003 | standalone today; rework in progress |
| howwasyourday | `apps/howwasyourday` | 3004 | yes |
| chhan-chhan | `apps/chhan-chhan` | 3005 | yes — artifacts in `_bmad-output/chhan-chhan/` |
| me-via-you | `apps/me-via-you` | 3006 | yes |
| markitdown | `apps/markitdown` | 3009 | no (Python) |
| pocket | `apps/pocket` | 3007 | hub, no auth |
| zeo | `apps/zeo` | 3008 | yes — artifacts in `_bmad-output/zeo/` |
| zeo-music-worker | `apps/zeo-music-worker` | 3010 | worker |

Existing **zeo** and **chhan-chhan** BMAD trees stay where they are. New monorepo-wide and **rhymes** rework artifacts stay in this folder.

Monorepo backlog: `implementation-artifacts/deferred-work.md` (magic-link sign-in for all auth-backed apps).

---

## rhymes (rework in progress)

### Project identity
- Current implementation lives at `apps/rhymes/`.
- The revamp is a brownfield redesign and platform upgrade, not a greenfield app.

### Product intent
- `rhymes` is a reader-first literary publishing product for poems, articles, songs, and diaries.
- The public experience must prioritize instant reading over click-through navigation.
- The authoring experience must prioritize very fast creation and editing for admins and future contributors.

### Core UX rules
- Keep a persistent reading surface visible on first load.
- Do not reduce the product to a card grid or a list-only blog.
- Browsing, filtering, and reading should happen in one continuous flow.
- Admin creation should support a bottom-docked quick composer with draft-first saving on `Enter`.
- The quick composer should expose a separate publish action beside the save action.
- The visual theme should be quiet, off-black/off-white, and typography-led.

### Content rules
- Content types in scope: poem, article, song, diary.
- Content must support plain text, Markdown, and sanitized HTML editing.
- Content titles must support both styled text and optional uploaded cover/title art.
- Page breaks are first-class and in current scope.
- Drafts are never public.
- Published content is public by default and can also be hidden by the creator/admin.
- Any logged-in user can rate eligible content.
- Default reader mode is configured per content piece, not rigidly by content type.
- The creator chooses the visible title treatment, but title art takes precedence and text title remains the fallback.
- Future background page-image repetition is explicitly deferred, but current data structures must allow it later.

### Collaboration and permissions
- Plan for multi-author support from the start.
- Prefer rhymes-specific memberships/roles over relying only on global auth roles.
- Support piece-level edit access in addition to project-level roles.

### Technical direction
- The current public `rhymes` shell is implemented in SvelteKit and should stay aligned with the monorepo's Bun + SvelteKit conventions.
- Favor reuse of the monorepo auth/database patterns already used by other apps.
- Treat the current markdown-in-repo implementation as migration input, not the long-term source of truth.
- Prefer database-backed content and metadata; use object storage/CDN only for assets such as cover art and future images.

### Spec posture
- Use BMAD artifacts in this folder as the canonical planning source for the revamp.
- Capture unresolved user decisions explicitly instead of hiding them in assumptions.
- The current foundational product questions for the revamp are resolved and can now be translated into epics/stories.
