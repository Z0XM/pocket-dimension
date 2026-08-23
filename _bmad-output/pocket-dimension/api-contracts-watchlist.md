# API Contracts — watchlist

Pages also SSR the home table, dashboard, and leaderboard. Mutations for the grid go through REST.

| Method | Path | Auth | Job |
| --- | --- | --- | --- |
| GET | `/api/watchlist` | Optional | Paginated list; session enriches “my” ratings |
| POST | `/api/watchlist/bulk-update` | Verified + role | Bulk create/update/delete |
| GET | `/api/watchlist/validate-title` | No | Title uniqueness |
| GET, POST | `/api/views` | Verified | List/create saved views |
| PUT, DELETE | `/api/views/[viewName]` | Verified | Update/favorite/delete view |
| GET | `/api/users` | Required | Usernames for rating columns |
| GET, POST | `/api/user-rating-preferences` | Required | Preferred rating columns |
| GET | `/api/dashboard` | Optional | Stats (`scope=catalog\|personal`) |
| GET | `/api/leaderboard` | No | Rankings |

Roles: `user` (read/rate), `contributor` (add titles), `admin` (delete). Mobile UI is read-only.
