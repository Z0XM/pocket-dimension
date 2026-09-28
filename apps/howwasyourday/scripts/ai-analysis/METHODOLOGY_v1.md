# Legacy recap AI analysis — methodology v1

**promptVersion:** `v1`  
Every subagent analyzing a profile **must** follow this document. Do not invent alternate frameworks, scoring systems, section layouts, or rubrics.

## Inputs

- One briefing pack: `scripts/ai-briefs/<slug>.json` (safer subset only).
- This methodology + `OUTPUT_CONTRACT_v1.md`.

**Never use:** private `day_note`, email, other profiles, web search, drawing image pixels.

## Checklist (walk in this order)

1. **Coverage** — `meta.daysFilled`, `gaps.fillRate`, `gaps.longestGapDays`. Hedge if sparse (“sparse log”).
2. **Score arc** — `scoreArc.monthlyAvg` trend (rising / falling / steady / volatile / U-shaped / recovery after a dip). Note best/worst month by avg. Note `longestHighStreak` (≥8) and `longestLowStreak` (≤4) if present.
3. **Emoji mood** — top 3–5 from `emojiMood` as palette; rare one-offs only if count is tiny vs leaders.
4. **Lexicon** — top `lexicon` words as self-labels. Optional loose buckets only if obvious: work / rest / feelings / people / places. Otherwise list themes plainly.
5. **People** — top `people` by count. Speak of connection vs solitude only if supported by people counts + public voice / month text.
6. **Public voice** — paraphrase `publicVoice`. Quotes only if ≤12 words and copied **exactly** from the brief.
7. **Month reflections** — synthesize good / bad / nextHopes; do not contradict month text.
8. **Color pulse** — at most one sentence if useful; never center the summary on color.
9. **Cross-check** — every `yearInThemes` item must trace to ≥1 signal above; drop unsupported themes.

## Score bands (do not redefine)

- **Low:** 1–4  
- **Mid:** 5–7  
- **High:** 8–10 (and 11 if present)

Treat emoji / word / people as **self-reported signals**. Prefer “often tagged days with X” over “you are X.”

## Evidence rules

- Use **only** the briefing pack.
- Do not invent events, trips, jobs, relationships, or quotes.
- Empty categories → short acknowledgment, not fabrication.
- Prefer month names and relative phrases tied to brief dates.
- `brightSpots` / `hardStretch`: 2–4 bullets each; each grounded in score, emoji, word, person, public note, or month field.

## Voice

- Warm yearbook / letter-to-self; second person (“you”) is fine.
- Curious, gentle, specific — howwasyourday tone.
- No medical, legal, crisis, or moral judgment. No clinical labels (depression, ADHD, trauma diagnosis, etc.).

## Forbidden

- New output keys or renamed sections.
- Invented metrics (“resilience score: 7.2”).
- Comparisons to other users or “average” recap users.
- Using private `day_note` if it appears — ignore it.
- Putting chain-of-thought in the output file — JSON contract only.
