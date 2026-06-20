# rhymes revamp architecture

## 1. Overview

`rhymes` should evolve from a standalone Astro + markdown reader into a reader-first publishing platform integrated with the monorepo's shared auth and database patterns. The architecture must support live authoring, rich document formatting, page breaks, ratings, permissions, title art, and future multi-author workflows while preserving the fast inline reading behavior that already differentiates the current app.

This architecture is intentionally provisional. It captures the current best-fit technical direction before implementation details are broken into epics and stories.

## 2. Current-state summary

- Current public app lives in `apps/rhymes/`.
- Current content source of truth is repo-committed markdown in `apps/rhymes/src/assets/rhymes/`.
- Current app has no auth, no CRUD API, and no admin UX.
- Current platform already provides reusable auth roles, session handling, and database conventions in other apps.

## 3. Recommended platform direction

### 3.1 Application framework

Preferred direction: migrate the rhymes app to an auth-friendly full-stack application pattern aligned with the monorepo's SvelteKit apps.

Reasoning:
- faster reuse of existing session and route-protection patterns
- easier integration of authenticated authoring flows
- easier server-side content APIs and file uploads
- more natural fit for live drafts, ratings, and permissions

Astro can technically be extended, but for this scope SvelteKit is the lower-friction long-term architecture inside this monorepo.

### 3.2 Source of truth

Preferred source of truth:
- database for content, metadata, revisions, ratings, permissions
- object storage/CDN for binary assets such as title art and future background images

Do not use CDN as the primary text store.

## 4. Domain model

### 4.1 Content piece

`rhymes_pieces`
- `id`
- `slug`
- `content_type` (`poem`, `article`, `song`, `diary`)
- `status` (`draft`, `published`)
- `visibility` (`public`, `hidden`)
- `author_id`
- `created_by_id`
- `updated_by_id`
- `published_at`
- `creator_rating`
- `reader_average_rating`
- `reader_rating_count`
- `title_mode` (`text`, `art`, `hybrid`)
- `display_title_mode` (`text`, `art`)
- `title_text_plain`
- `title_rich_json`
- `title_art_asset_id`
- `default_reader_mode` (`paged`, `continuous`)

### 4.2 Content body

Two-layer model:
- canonical structured document JSON
- optional source payload metadata for plain text / Markdown / HTML editing modes

This supports:
- span-level formatting
- page breaks
- safe rendering
- future export/import

### 4.3 Pages

Either:
- explicit `rhymes_piece_pages` table
or
- page-break nodes within the canonical document model

Recommendation: page-break nodes in the document model first, with computed page indexes. This is simpler for migration and editing while preserving explicit page semantics.

### 4.4 Assets

`rhymes_assets`
- `id`
- `piece_id`
- `kind` (`title_art`, `cover_art`, later `page_background`)
- `storage_key`
- `mime_type`
- `width`
- `height`
- `created_by_id`

### 4.5 Ratings

`rhymes_piece_ratings`
- `piece_id`
- `user_id`
- `rating` (0-10, numeric)
- `created_at`
- `updated_at`

Keep creator rating on the piece record and user ratings in a separate table.

### 4.6 Memberships and permissions

`rhymes_memberships`
- `user_id`
- `role` (`owner`, `admin`, `editor`, `contributor`, `viewer`)

`rhymes_piece_permissions`
- `piece_id`
- `user_id`
- `permission_level`

## 5. Editing model

### 5.1 Authoring modes

The UI should support:
- quick composer mode
- expanded editor mode
- source-mode editing for plain text, Markdown, or HTML
- rich editing for styling and page breaks

### 5.2 Canonical document representation

Recommendation:
- canonical structured JSON document
- imported/exported views for Markdown and HTML
- sanitized HTML render output for public display
- workflow metadata for draft-first save, publish action, and hidden-published state

Rationale:
- raw Markdown alone cannot represent all requested formatting cleanly
- raw HTML alone is unsafe and too unconstrained
- structured JSON supports spans, title formatting, page breaks, and future extensions

## 6. Rendering strategy

### 6.1 Public rendering

Server-render piece summaries and the initial selected piece for fast first paint.

Client-enhanced behavior handles:
- switching pieces
- filtering
- page navigation
- rating updates
- editor interactions when logged in

### 6.2 Safety

All HTML input must be sanitized before storage and/or before render, depending on the chosen editor pipeline. Sanitized render output must be the only public HTML emitted to readers.

## 7. Migration strategy

### Phase A
- Keep existing markdown corpus as migration source.
- Write importer to map current frontmatter + body into the new piece model.

### Phase B
- Preserve legacy fields where useful: tags, thought date, rating, status, phase.
- Map current rating into creator rating where appropriate.

### Phase C
- Verify imported content renders correctly in reader mode before turning off markdown-file loading.

## 8. API surface

Minimum server capabilities:
- list published pieces
- fetch piece detail
- search/filter/sort
- create piece
- update piece
- publish/unpublish piece
- hide/unhide published piece
- upload title art
- assign membership/permissions
- create/update rating

## 9. Operational concerns

- Use shared auth session model from the monorepo.
- Reuse shared DB schema patterns including `created_by_id` and `updated_by_id`.
- Keep export tooling so the content archive remains portable.

## 10. Key trade-offs

### File-based markdown vs DB-backed content
- File-based keeps content simple and portable.
- DB-backed content is required for live authoring, permissions, ratings, and multi-author growth.
- Recommendation: DB-backed primary model plus export tooling.

### Astro extension vs SvelteKit migration
- Astro minimizes initial framework change.
- SvelteKit better matches the required authenticated application behavior in this monorepo.
- Recommendation: SvelteKit if the team accepts migration scope.

### Page table vs page-break nodes
- Page table gives explicit structure.
- Page-break nodes keep editing simpler and still satisfy current requirements.
- Recommendation: page-break nodes now, evolve later if needed.

## 11. Locked product decisions

- Quick composer saves drafts by default on `Enter`.
- Publish is exposed as a separate action beside save.
- Drafts are never public.
- Published content is public by default and can be hidden.
- Any logged-in user can rate content.
- Default reading mode is stored per content piece rather than derived from content type.
- Creator chooses whether title art or text title is displayed; title art takes precedence and text title remains the fallback.

## 12. Implementation readiness

The current planning set is ready to be translated into epics/stories for implementation.
