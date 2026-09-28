# Legacy recap AI analysis (subagent-written)

Offline **insight notes** for claim-gated dashboards. No in-app LLM — subagents write lean JSON; import upserts Postgres.

Current contract: **`promptVersion` `v3`** — headline + one reflection (+ optional theme chips). Not a statistical caption of mood/people/word boards.

## Pipeline

```bash
cd apps/howwasyourday
bun run build:legacy-recap-ai-briefs
# one subagent per slug using SUBAGENT_TASK_TEMPLATE.md (v3)
bun run import:legacy-recap-ai-analysis
```

Docs: [`METHODOLOGY_v3.md`](./METHODOLOGY_v3.md) · [`OUTPUT_CONTRACT_v3.md`](./OUTPUT_CONTRACT_v3.md)

`ai-briefs/` and `ai-out/` are gitignored. Never shown on the public index.
