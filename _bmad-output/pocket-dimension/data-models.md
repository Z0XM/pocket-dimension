# Data Models — Pocket Dimension

**Source of truth:** `shared/db` (`@pocket-dimension/db`). Apps do not own schema files.

PostgreSQL **18+** is required. Primary keys use `DEFAULT uuidv7()` from `shared/db/src/schema/common.ts`. Tables live in **named schemas**, not `public` (except `user_role` enum).

Migrations: `shared/db/migrations/` (0000–0032 as of this scan). Apply with `bun run db:migrate`. zeo production `bun run start` also applies pending migrations when `DATABASE_URL` is set.

## Common columns

From `shared/db/src/schema/common.ts`:

| Helper | Columns |
| --- | --- |
| `id` | UUID PK, `uuidv7()` |
| `timestamps` | `created_at`, `updated_at` |
| `actionsByUser` | `created_by_id`, `updated_by_id` → `auth.user` |

App tables that store users FK to `auth.user.id` (typically cascade delete).

## Schema `auth` — `shared/db/src/schema/auth.ts`

| Table | Purpose |
| --- | --- |
| `user` | Email, username, `role` (`user` \| `contributor` \| `admin`), verification flags |
| `session` | Better Auth sessions |
| `account` | Credential / OAuth accounts |
| `verification` | Email and token verification |

Enum: `public.user_role`.

## Schema `watchlist` — `shared/db/src/schema/watchlist.ts`

| Table | Purpose |
| --- | --- |
| `watch_items` | Titles (type, language, release status) |
| `watch_languages`, `watch_tags`, `watch_item_tags` | Lookups + M2M |
| `watch_item_ratings` | Per-user rating, flags, progress, review |
| `watchlist_views` | Saved filter/sort views |
| `user_rating_preferences` | Which other users’ ratings to show as columns |

## Schema `howwasyourday` — `shared/db/src/schema/howwasyourday.ts`

| Table | Purpose |
| --- | --- |
| `day_data` | One row per `(user_id, day_int)`; flexible `metadata` JSON |
| `push_subscription` | Web Push endpoint, timezone, reminder time |

## Schema `chhanchhan` — `shared/db/src/schema/chhanchhan.ts`

Finance ledger. Full field-level docs: [`_bmad-output/chhan-chhan/planning-artifacts/data-models.md`](../chhan-chhan/planning-artifacts/data-models.md).

| Table | Purpose |
| --- | --- |
| `finance_accounts` | Account snapshot (balance in paise) |
| `finance_account_members` | Owner/editor membership |
| `finance_categories` | Categories |
| `finance_transactions` | Transactions + running `balance_minor` |
| `finance_budgets`, `finance_goals` | Budgets/goals (display exists; Control CRUD still backlog) |
| `finance_tags`, `finance_transaction_tags` | Tags |
| `finance_groups`, `finance_transaction_groups` | Groups |
| `finance_transaction_refund_links` | Refund pairing |

Money is always **minor units (paise)**.

## Schema `meviayou` — `shared/db/src/schema/meviayou.ts`

| Table | Purpose |
| --- | --- |
| `forms` | Question, classification, status, `public_slug`, `closes_at`, `hidden_from_public` |
| `answers` | Primary/expand/notes, respondent name, anonymous flag |

## Schema `zeo` — `shared/db/src/schema/zeo.ts`

| Table | Purpose |
| --- | --- |
| `rooms` | slug, LiveKit room name, host, status, waiting/public/perpetual/locked/scheduled |
| `room_participants` | Join/leave audit |
| `room_session_blocks` | Rejoin block after host remove |
| `room_waiting_entries` | Waiting-room queue |
| `chat_messages` | Text + snapshot |
| `operator_settings` | Max rooms/participants, chat/scheduling toggles |
| `game_sessions`, `game_teams`, `game_participants`, `game_rounds`, `game_suggestions`, `game_suggestion_votes` | Charades |
| `room_scores` | Per-room scores |
| `youtube_account_links` | Encrypted YouTube OAuth |
| `listening_sessions`, `listening_queue_items` | Shared listening |

## Parts without a DB schema

| Part | Persistence |
| --- | --- |
| rhymes | Markdown corpus `apps/rhymes/src/assets/rhymes/*.md` (Vite glob). Revamp plans DB-backed content. |
| pocket | Env URLs only |
| markitdown | Stateless temp files |
| shared-utils | None |
| zeo-music-worker | No own DB; talks to zeo APIs |

## Migration strategy

1. Edit `shared/db/src/schema/*.ts`
2. `bun run db:generate`
3. Review SQL in `shared/db/migrations/`
4. `bun run db:migrate`
