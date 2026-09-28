import { createHash } from "node:crypto";
import type { DayEntry, MonthEntry, UserRecap } from "./types";
import { computeGaps, countBy, monthLabel, normalizePerson, wordTokens } from "./types";
import { AI_BRIEF_VERSION, AI_PROMPT_VERSION, type AiAnalysisBody, type AiAnalysisOutFile, type AiBrief } from "./ai-analysis-types";

export { AI_BRIEF_VERSION, AI_PROMPT_VERSION, type AiAnalysisBody, type AiAnalysisOutFile, type AiBrief } from "./ai-analysis-types";

const PUBLIC_NOTE_MAX = 280;
const PUBLIC_NOTE_LIMIT = 80;
const TOP_N = 24;

function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function monthName(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function weekBuckets(days: DayEntry[]): { start: string; end: string; avg: number; count: number }[] {
  const scored = days.filter((d) => d.day_score != null) as (DayEntry & { day_score: number })[];
  if (!scored.length) return [];
  const out: { start: string; end: string; avg: number; count: number }[] = [];
  for (let i = 0; i < scored.length; i++) {
    const start = scored[i].date;
    let sum = 0;
    let count = 0;
    let end = start;
    for (let j = i; j < scored.length && j < i + 7; j++) {
      sum += scored[j].day_score;
      count++;
      end = scored[j].date;
    }
    if (count >= 3) out.push({ start, end, avg: Math.round((sum / count) * 100) / 100, count });
  }
  return out;
}

function streak(days: DayEntry[], pred: (s: number) => boolean): { days: number; start: string; end: string } | null {
  let best: { days: number; start: string; end: string } | null = null;
  let curStart: string | null = null;
  let curEnd: string | null = null;
  let curLen = 0;

  const flush = () => {
    if (curLen > 0 && curStart && curEnd) {
      if (!best || curLen > best.days) best = { days: curLen, start: curStart, end: curEnd };
    }
    curStart = null;
    curEnd = null;
    curLen = 0;
  };

  for (const d of days) {
    if (d.day_score == null || !pred(d.day_score)) {
      flush();
      continue;
    }
    if (!curStart) curStart = d.date;
    curEnd = d.date;
    curLen++;
  }
  flush();
  return best;
}

function quarterOf(iso: string): string {
  const m = Number(iso.slice(5, 7));
  if (m <= 3) return "Q1";
  if (m <= 6) return "Q2";
  if (m <= 9) return "Q3";
  return "Q4";
}

function fingerprintPayload(body: Omit<AiBrief, "fingerprint">): string {
  const json = JSON.stringify(body);
  return createHash("sha256").update(json).digest("hex").slice(0, 32);
}

/** Build a safer-subset briefing pack (excludes private day_note). */
export function buildAiBrief(recap: UserRecap, slug: string, year = 2025): AiBrief {
  const days = [...(recap.days ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const summary = recap.summary;
  const months = (recap.months ?? []) as MonthEntry[];

  const byMonth = new Map<string, number[]>();
  for (const d of days) {
    if (d.day_score == null) continue;
    const k = monthKey(d.date);
    const arr = byMonth.get(k) ?? [];
    arr.push(d.day_score);
    byMonth.set(k, arr);
  }
  const monthlyAvg = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, scores]) => ({
      month: monthName(ym),
      avg: scores.length ? Math.round((scores.reduce((s, n) => s + n, 0) / scores.length) * 100) / 100 : null,
      count: scores.length,
    }));

  const weeks = weekBuckets(days);
  const bestWeek = weeks.length ? [...weeks].sort((a, b) => b.avg - a.avg || b.count - a.count)[0] : null;
  const worstWeek = weeks.length ? [...weeks].sort((a, b) => a.avg - b.avg || b.count - a.count)[0] : null;

  let low = 0;
  let mid = 0;
  let high = 0;
  for (const d of days) {
    const s = d.day_score;
    if (s == null) continue;
    if (s <= 4) low++;
    else if (s <= 7) mid++;
    else high++;
  }

  const publicVoice = days
    .filter((d) => d.day_public_note?.trim())
    .slice(0, PUBLIC_NOTE_LIMIT)
    .map((d) => ({
      date: d.date,
      note: d.day_public_note.trim().slice(0, PUBLIC_NOTE_MAX),
    }));

  const colorByQ = new Map<string, Map<string, number>>();
  for (const d of days) {
    const c = d.day_color?.trim();
    if (!c) continue;
    const q = quarterOf(d.date);
    const m = colorByQ.get(q) ?? new Map<string, number>();
    m.set(c, (m.get(c) || 0) + 1);
    colorByQ.set(q, m);
  }
  const colorPulse = ["Q1", "Q2", "Q3", "Q4"].map((quarter) => {
    const m = colorByQ.get(quarter);
    const topColors = m
      ? [...m.entries()]
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      : [];
    return { quarter, topColors };
  });

  const gapsList = computeGaps(days);
  const longest = gapsList[0] ?? null;
  const fillRate = Math.round((days.length / 365) * 1000) / 1000;

  const withoutFp = {
    promptVersion: AI_BRIEF_VERSION,
    meta: {
      slug,
      displayName: recap.user.display_name,
      accentColor: recap.user.accent_color,
      daysFilled: summary.days_filled,
      monthsFilled: summary.months_filled,
      drawingsCount: summary.drawings_count ?? days.filter((d) => d.has_drawing || d.drawing_src).length,
      firstDate: summary.first_date,
      lastDate: summary.last_date,
      avgScore: summary.avg_score,
      minScore: summary.min_score,
      maxScore: summary.max_score,
      year,
    },
    scoreArc: {
      monthlyAvg,
      bestWeek: bestWeek ? { start: bestWeek.start, end: bestWeek.end, avg: bestWeek.avg } : null,
      worstWeek: worstWeek ? { start: worstWeek.start, end: worstWeek.end, avg: worstWeek.avg } : null,
      longestHighStreak: streak(days, (s) => s >= 8),
      longestLowStreak: streak(days, (s) => s <= 4),
      histogram: { low, mid, high },
    },
    emojiMood: countBy(days.map((d) => d.day_emoji).filter(Boolean)).slice(0, TOP_N),
    lexicon: wordTokens(days).slice(0, TOP_N),
    people: countBy(days.map((d) => normalizePerson(d.day_person)).filter(Boolean)).slice(0, TOP_N),
    publicVoice,
    monthReflections: months.map((m) => ({
      monthInt: m.month_int,
      monthLabel: monthLabel(m.month_int),
      good: (m.month_good || "").trim(),
      bad: (m.month_bad || "").trim(),
      nextHopes: (m.month_next_hopes || "").trim(),
    })),
    colorPulse,
    gaps: {
      fillRate,
      longestGapDays: longest?.days ?? 0,
      longestGap: longest,
    },
  } satisfies Omit<AiBrief, "fingerprint">;

  return {
    ...withoutFp,
    fingerprint: fingerprintPayload(withoutFp),
  };
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function clampLen(s: string, max: number): boolean {
  return s.length <= max;
}

/** Validate subagent output before DB upsert. Returns error message or null. */
export function validateAiOutFile(raw: unknown): { ok: true; value: AiAnalysisOutFile } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Root must be an object" };
  }
  const o = raw as Record<string, unknown>;
  if (!isNonEmptyString(o.slug)) return { ok: false, error: "Missing slug" };
  if (o.promptVersion !== AI_PROMPT_VERSION) {
    return { ok: false, error: `promptVersion must be "${AI_PROMPT_VERSION}"` };
  }
  if (!isNonEmptyString(o.inputFingerprint)) return { ok: false, error: "Missing inputFingerprint" };
  if (!isNonEmptyString(o.modelLabel)) return { ok: false, error: "Missing modelLabel" };
  if (!o.analysis || typeof o.analysis !== "object" || Array.isArray(o.analysis)) {
    return { ok: false, error: "Missing analysis object" };
  }
  const a = o.analysis as Record<string, unknown>;

  if (!isNonEmptyString(a.headline) || !clampLen(a.headline, 72)) {
    return { ok: false, error: "headline required (≤72 chars)" };
  }
  if (!isNonEmptyString(a.reflection) || !clampLen(a.reflection, 320)) {
    return { ok: false, error: "reflection required (≤320 chars)" };
  }

  // Reject chart-caption / stats-speak patterns (soft heuristics).
  const blob = `${a.headline} ${a.reflection}`.toLowerCase();
  const banned = ["scores dipped", "score arc", "avg score", "days filled", "fill rate", "leading the tags", "top emoji", "word cloud", "checked in"];
  for (const b of banned) {
    if (blob.includes(b)) {
      return { ok: false, error: `sounds like a data caption (“${b}”) — write insight, not stats` };
    }
  }

  let themes: string[] = [];
  if (a.themes != null) {
    if (!Array.isArray(a.themes) || a.themes.length > 4) {
      return { ok: false, error: "themes must be 0–4 short strings" };
    }
    if (!a.themes.every((t) => isNonEmptyString(t) && clampLen(t, 32))) {
      return { ok: false, error: "each theme must be a non-empty string ≤32 chars" };
    }
    themes = (a.themes as string[]).map((s) => s.trim());
  }

  if (!Array.isArray(a.disclaimers) || a.disclaimers.length < 1 || !a.disclaimers.every(isNonEmptyString)) {
    return { ok: false, error: "disclaimers must be a non-empty string array" };
  }
  const joined = a.disclaimers.join(" ").toLowerCase();
  if (!joined.includes("logged") && !joined.includes("day")) {
    return { ok: false, error: "disclaimers should note analysis is based on logged days only" };
  }

  return {
    ok: true,
    value: {
      slug: o.slug.trim(),
      promptVersion: AI_PROMPT_VERSION,
      inputFingerprint: o.inputFingerprint.trim(),
      modelLabel: o.modelLabel.trim(),
      analysis: {
        headline: a.headline.trim(),
        reflection: a.reflection.trim(),
        themes,
        disclaimers: (a.disclaimers as string[]).map((s) => s.trim()),
      },
    },
  };
}
