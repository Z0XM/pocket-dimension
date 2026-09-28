# Legacy recap AI analysis — output contract v3

**promptVersion:** `v3`

Write exactly one file: `apps/howwasyourday/scripts/ai-out/<slug>.json`

Copy `fingerprint` from the brief → `inputFingerprint`.

## Schema

```ts
{
  slug: string;
  promptVersion: "v3";
  inputFingerprint: string;
  modelLabel: string; // "cursor-subagent"
  analysis: {
    headline: string;      // ≤72 chars — insight, not chart synopsis
    reflection: string;    // ≤320 chars — ONE short paragraph
    themes: string[];      // 0–4 chips, each ≤32 chars (optional; [] ok)
    disclaimers: string[]; // include logged-days-only
  }
}
```

## Rules

- No moodPulse / peopleAlongside / yearLook / emotionalJourney fields.
- Do not caption emojis, colors, words, or people rankings.
- Headline and reflection must not say the same thing twice.
- Prefer public notes + month reflections for emotional truth.

## Required disclaimer

e.g. `"Based on logged days only — not a complete record of the year."`
