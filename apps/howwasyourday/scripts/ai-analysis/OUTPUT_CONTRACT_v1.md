# Legacy recap AI analysis — output contract v1

**promptVersion:** `v1`

Write exactly one file: `apps/howwasyourday/scripts/ai-out/<slug>.json`

Copy `fingerprint` from the brief into `inputFingerprint`. Set `promptVersion` to `"v1"`.

## Schema

```ts
{
  slug: string;
  promptVersion: "v1";
  inputFingerprint: string;
  modelLabel: string; // e.g. "cursor-subagent"
  analysis: {
    headline: string;              // ≤90 chars
    overview: string;              // 2–4 short paragraphs
    yearInThemes: {                // 3–6 items
      title: string;               // ≤40 chars
      detail: string;              // 1–3 sentences
    }[];
    emotionalArc: string;          // score + emoji story
    peopleAndConnection: string;
    languageAndSelfTalk: string;   // day_word + public notes
    brightSpots: string[];         // 2–4
    hardStretch: string[];         // 2–4
    closingNote: string;           // 1–3 sentences
    disclaimers: string[];         // include logged-days-only note
  }
}
```

## Required disclaimer

Include at least one disclaimer that analysis is based on **logged days only** (e.g. `"Based on logged days only — not a complete record of the year."`).

## Validation

The import script rejects files that break length bounds, array sizes, `promptVersion`, or missing fields. Do not add extra top-level or `analysis` keys.
