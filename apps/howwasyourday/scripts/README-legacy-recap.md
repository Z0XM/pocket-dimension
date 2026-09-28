# Legacy 2025 recap import

One-shot (idempotent) seed from a local year-recap export into Postgres.

1. Copy `legacy-recap-emails.example.json` → `legacy-recap-emails.json` and fill `{ "slug": "email" }` (gitignored).
2. Set `YEAR_RECAP_EXPORT_DIR` to the year-recap **dashboard** folder (`src/data` + `public/drawings`).
3. From `apps/howwasyourday`:

```bash
YEAR_RECAP_EXPORT_DIR=/path/to/year-recap/dashboard \
YEAR_RECAP_EMAILS_FILE=./scripts/legacy-recap-emails.json \
bun run import:legacy-recap-2025
```

Never commit emails or export JSON/PNGs. See `DEPLOY.md` for production ops notes.

## AI year summaries (subagent-written)

See [`ai-analysis/README.md`](./ai-analysis/README.md) for briefing packs, methodology v1, subagent template, and import into `legacy_recap_ai_analysis`.
