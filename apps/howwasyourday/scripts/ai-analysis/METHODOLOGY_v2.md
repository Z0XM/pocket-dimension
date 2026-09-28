# Legacy recap AI analysis — methodology v2

**promptVersion:** `v2`  
Highlight reel, not essay. Short, warm, specific — never a wall of text.

## Product goal

Surface **how the year felt**, the **emotional journey**, **who was alongside**, and a few **theme chips**.  
Do **not** narrate check-in counts, day-by-day activities, or lexicon essays (“you used the word X which means…”).

## Inputs

- One briefing pack: `scripts/ai-briefs/<slug>.json`
- This methodology + `OUTPUT_CONTRACT_v2.md`

**Never use:** private `day_note`, email, other profiles, web search, drawing pixels.

## Checklist (in order — keep each step brief in the final JSON)

1. **Coverage** — If sparse, hedge lightly inside `yearLook` (“from the days you logged…”). Do not lead with day counts.
2. **Year look** — One vibe from score arc + month reflections + public voice. No inventory of what they “did.”
3. **Emotional journey** — Score trend + emoji mood in 1–2 sentences. Allowed: rising / falling / steady / volatile / recovery after a dip.
4. **People** — Top names as companions, not biographies. If thin: “Few names on the log” / “Mostly a solo trail.”
5. **Themes** — 3–5 **short chips** (≤36 chars). Phrases, not paragraphs. Traceable to brief signals.
6. **Mood pulse** — Optional one line on top emoji and/or color pulse. Skip if empty or weak.
7. **Cross-check** — Drop any theme you cannot ground in the brief.

## Score bands (do not redefine)

- **Low:** 1–4 · **Mid:** 5–7 · **High:** 8–10 (and 11 if present)

Treat emoji / people as self-reported signals. Prefer “days often tagged with …” over “you are ….”

## Hard bans

- Language / self-talk / word-frequency analysis in the output.
- Bright-spot / hard-stretch bullet essays.
- Invented events, trips, jobs, relationships, quotes.
- Clinical labels, moral judgment, comparisons to other users.
- Extra keys, invented metrics, chain-of-thought in the JSON file.
