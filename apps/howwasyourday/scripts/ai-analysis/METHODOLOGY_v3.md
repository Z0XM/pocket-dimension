# Legacy recap AI analysis — methodology v3

**promptVersion:** `v3`  
Insight about the person — **not** a statistical caption of the dashboard.

## What this section is for

The claim-gated dashboard already shows scores, emojis, colors, words, and people.  
This AI note should answer: **what does their logged year suggest about them?**  
Warm, specific, emotional. One thought — not three paraphrases of the same score arc.

## Inputs

- Brief: `scripts/ai-briefs/<slug>.json`
- This file + `OUTPUT_CONTRACT_v3.md`

**Never use:** private `day_note`, email, other profiles, web, drawing pixels.

## How to read the brief (quietly)

Use score/emoji/people/color **only as private context**. Do **not** narrate them (“😄 led the tags”, “colors lean green”, “Sanchi leads your people tags”).  
Prefer **public voice** and **month reflections** for substance. If those are empty, write a short felt impression from overall tone — still without chart-speak.

## What to write

1. **headline** — One sharp human line. Not “Rough February then scores recovered.” More like what that *meant* for them.
2. **reflection** — A single short paragraph (2–4 sentences max). Insightful. No repeat of the headline. No second “emotional journey” that restates the same plot.
3. **themes** — Optional 0–4 interpretive chips. Skip if they’d only duplicate the reflection. Never data labels.

## Hard bans

- Restating mood board / heatmap / dictionary / people wall.
- Listing emoji, colors, top words, people counts, day counts, averages, streaks.
- Sections that exist “for completeness” when empty of insight.
- Repeating the same arc in headline + body.
- Clinical labels, invented events, moral judgment, other-user comparisons.
- Extra JSON keys / chain-of-thought in the file.
