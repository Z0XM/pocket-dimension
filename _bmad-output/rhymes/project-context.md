## rhymes project context

### Project identity
- Product name for planning artifacts: `rhymes`.
- Current implementation lives at `apps/rhymes/` inside the Pocket Dimension monorepo.
- The revamp is a brownfield redesign and platform upgrade, not a greenfield app.

### Product intent
- `rhymes` is a reader-first literary publishing product for poems, articles, songs, and diaries.
- The public experience must prioritize instant reading over click-through navigation.
- The authoring experience must prioritize very fast creation and editing for admins and future contributors.

### Core UX rules
- Keep a persistent reading surface visible on first load.
- Do not reduce the product to a card grid or a list-only blog.
- Browsing, filtering, and reading should happen in one continuous flow.
- Admin creation should support a bottom-docked quick composer with `Enter`-to-save behavior.
- The visual theme should be quiet, off-black/off-white, and typography-led.

### Content rules
- Content types in scope: poem, article, song, diary.
- Content must support plain text, Markdown, and sanitized HTML editing.
- Content titles must support both styled text and optional uploaded cover/title art.
- Page breaks are first-class and in current scope.
- Future background page-image repetition is explicitly deferred, but current data structures must allow it later.

### Collaboration and permissions
- Plan for multi-author support from the start.
- Prefer rhymes-specific memberships/roles over relying only on global auth roles.
- Support piece-level edit access in addition to project-level roles.

### Technical direction
- Favor reuse of the monorepo auth/database patterns already used by other apps.
- Treat the current markdown-in-repo implementation as migration input, not the long-term source of truth.
- Prefer database-backed content and metadata; use object storage/CDN only for assets such as cover art and future images.

### Spec posture
- Use BMAD artifacts as the canonical planning source for this revamp.
- Capture unresolved user decisions explicitly instead of hiding them in assumptions.
- Do not create implementation stories until the user resolves the current open product questions.
