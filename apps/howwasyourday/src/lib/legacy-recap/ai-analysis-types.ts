/** Shared types / constants for legacy recap AI analysis (safe for client). */

/** Analysis output contract version (subagent JSON + DB prompt_version). */
export const AI_PROMPT_VERSION = "v3" as const;

/** Briefing-pack shape version (embedded in brief JSON). */
export const AI_BRIEF_VERSION = "v1" as const;

/**
 * Insight-only highlight — not a chart caption.
 * Optional fields may be omitted or empty when they would only restate the dashboard.
 */
export type AiAnalysisBody = {
  /** One sharp, human line — not a score-plot synopsis. */
  headline: string;
  /**
   * The only prose block: who they seem to be / what the logged year suggests about them.
   * Prefer public notes + month reflections + felt tone. Do not restate charts.
   */
  reflection: string;
  /**
   * Optional interpretive chips (not data labels like "😄 led" or "February avg 4.2").
   * Empty array if nothing insightful beyond the reflection.
   */
  themes: string[];
  disclaimers: string[];
};

/** File written by subagents under scripts/ai-out/<slug>.json */
export type AiAnalysisOutFile = {
  slug: string;
  promptVersion: typeof AI_PROMPT_VERSION;
  inputFingerprint: string;
  modelLabel: string;
  analysis: AiAnalysisBody;
};

export type AiBrief = {
  promptVersion: typeof AI_BRIEF_VERSION;
  fingerprint: string;
  meta: {
    slug: string;
    displayName: string;
    accentColor: string;
    daysFilled: number;
    monthsFilled: number;
    drawingsCount: number;
    firstDate: string | null;
    lastDate: string | null;
    avgScore: number | null;
    minScore: number | null;
    maxScore: number | null;
    year: number;
  };
  scoreArc: {
    monthlyAvg: { month: string; avg: number | null; count: number }[];
    bestWeek: { start: string; end: string; avg: number } | null;
    worstWeek: { start: string; end: string; avg: number } | null;
    longestHighStreak: { days: number; start: string; end: string } | null;
    longestLowStreak: { days: number; start: string; end: string } | null;
    histogram: { low: number; mid: number; high: number };
  };
  emojiMood: { label: string; count: number }[];
  lexicon: { label: string; count: number }[];
  people: { label: string; count: number }[];
  publicVoice: { date: string; note: string }[];
  monthReflections: {
    monthInt: number;
    monthLabel: string;
    good: string;
    bad: string;
    nextHopes: string;
  }[];
  colorPulse: { quarter: string; topColors: { label: string; count: number }[] }[];
  gaps: {
    fillRate: number;
    longestGapDays: number;
    longestGap: { after: string; before: string; days: number } | null;
  };
};
