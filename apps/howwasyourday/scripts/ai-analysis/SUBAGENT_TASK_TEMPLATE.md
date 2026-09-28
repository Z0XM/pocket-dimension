# Subagent task template (legacy recap AI v3)

Copy this prompt when launching **one subagent per profile**. Replace `SLUG` only.

---

You are writing a **short insightful note** about **one** howwasyourday Legacy 2025 profile — about the person, not a chart summary.

## Read (mandatory)

1. `apps/howwasyourday/scripts/ai-analysis/METHODOLOGY_v3.md`
2. `apps/howwasyourday/scripts/ai-analysis/OUTPUT_CONTRACT_v3.md`
3. `apps/howwasyourday/scripts/ai-briefs/SLUG.json`

## Do

1. Write **only** `apps/howwasyourday/scripts/ai-out/SLUG.json` matching v3.
2. Copy `fingerprint` → `inputFingerprint`. Set `promptVersion` `"v3"`, `modelLabel` `"cursor-subagent"`.
3. Output: `headline` + one `reflection` paragraph + optional `themes` chips (0–4).
4. **Do not** restate emojis, colors, words, people counts, or score plots (the UI already shows those).
5. **Do not** repeat the same arc in headline and reflection.
6. Prefer public notes + month reflections for emotional insight.
7. No APIs, DB, or other files.

## Done when

- File exists and would pass v3 validation.

---

```bash
cd apps/howwasyourday && bun run import:legacy-recap-ai-analysis
```
