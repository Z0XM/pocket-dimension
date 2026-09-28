# Legacy recap AI analysis — output contract v2

**promptVersion:** `v2`

Write exactly one file: `apps/howwasyourday/scripts/ai-out/<slug>.json`

Copy `fingerprint` from the brief into `inputFingerprint`.

## Schema

```ts
{
  slug: string;
  promptVersion: "v2";
  inputFingerprint: string;
  modelLabel: string; // e.g. "cursor-subagent"
  analysis: {
    headline: string;           // ≤72 chars — punchy
    yearLook: string;           // ≤220 chars — 1–2 sentences
    emotionalJourney: string;   // ≤220 chars — 1–2 sentences
    peopleAlongside: string;    // ≤180 chars
    themes: string[];           // 3–5 chips, each ≤36 chars
    moodPulse: string;          // ≤120 chars, or "" if skip
    disclaimers: string[];      // include logged-days-only
  }
}
```

## Tone

Yearbook highlights. Second person OK. No section essays. No “you checked in N days.”

## Required disclaimer

At least one: e.g. `"Based on logged days only — not a complete record of the year."`
