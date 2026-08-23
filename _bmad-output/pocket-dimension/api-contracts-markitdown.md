# API Contracts — markitdown

| Method | Path | Auth | Job |
| --- | --- | --- | --- |
| POST | `/api/convert` | No | Multipart `file` → `{ markdown, filename }` or `{ error }` (400/500) |

Max upload 50 MB (`BODY_SIZE_LIMIT`). Allowed extensions in `src/lib/server/markitdown.ts`. Conversion is `Bun.spawn` of `python/convert.py` (Microsoft markitdown).
