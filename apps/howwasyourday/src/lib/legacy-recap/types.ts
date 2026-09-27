export type DayEntry = {
  day_int: number;
  date: string;
  day_score: number | null;
  day_word: string;
  day_person: string;
  day_note: string;
  day_color: string;
  day_emoji: string;
  day_public_note: string;
  has_drawing: boolean;
  drawing_src: string | null;
};

export type MonthEntry = {
  month_int: number;
  month_good: string;
  month_bad: string;
  month_next_hopes: string;
};

export type UserRecap = {
  user: {
    id: string;
    display_name: string;
    accent_color: string;
  };
  summary: {
    rank?: number;
    slug?: string;
    days_filled: number;
    months_filled: number;
    drawings_count?: number;
    first_day: number | null;
    last_day: number | null;
    first_date: string | null;
    last_date: string | null;
    avg_score: number | null;
    min_score: number | null;
    max_score: number | null;
  };
  days: DayEntry[];
  months: MonthEntry[];
};

export type UserIndexEntry = {
  rank: number;
  slug: string;
  display_name: string;
  accent_color: string;
  days_filled: number;
  drawings_count?: number;
  months_filled?: number;
  avg_score: number | null;
  first_date: string | null;
  last_date: string | null;
};

export type CountItem = { label: string; count: number };

export function formatShortDate(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function formatMonthYear(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function parseDate(isoDate: string): Date {
  return new Date(isoDate + "T12:00:00");
}

export function dayDiff(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
}

export function countBy(values: string[]): CountItem[] {
  const map = new Map<string, number>();
  for (const raw of values) {
    const label = raw.trim();
    if (!label) continue;
    map.set(label, (map.get(label) || 0) + 1);
  }
  return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Normalize person names lightly for grouping. */
export function normalizePerson(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

const STOP = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "at",
  "is",
  "was",
  "were",
  "be",
  "been",
  "am",
  "are",
  "it",
  "my",
  "me",
  "i",
  "we",
  "you",
  "yet",
  "so",
  "too",
  "very",
  "just",
  "from",
  "into",
  "out",
  "up",
  "down",
  "day",
]);

export function wordTokens(days: DayEntry[]): CountItem[] {
  const map = new Map<string, number>();
  for (const day of days) {
    const text = day.day_word || "";
    const parts = text
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, " ")
      .split(/\s+/)
      .map((w) => w.replace(/^'+|'+$/g, ""))
      .filter((w) => w.length > 2 && !STOP.has(w));
    const unique = new Set(parts);
    for (const w of unique) map.set(w, (map.get(w) || 0) + 1);
  }
  return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export type Gap = { after: string; before: string; days: number };

export function computeGaps(days: DayEntry[]): Gap[] {
  const gaps: Gap[] = [];
  for (let i = 1; i < days.length; i++) {
    const span = dayDiff(days[i - 1].date, days[i].date);
    if (span > 1) {
      gaps.push({ after: days[i - 1].date, before: days[i].date, days: span - 1 });
    }
  }
  return gaps.sort((a, b) => b.days - a.days);
}

export type HeatCell = {
  date: string;
  day_int: number;
  filled: boolean;
  score: number | null;
  color: string;
  emoji: string;
};

/** Build Jan–Dec 2025 daily cells for the span covering logged days. */
export function buildYearHeatmap(days: DayEntry[], year = 2025): HeatCell[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const cells: HeatCell[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    const d = new Date(t);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const iso = `${y}-${m}-${day}`;
    const day_int = Number(`${y}${m}${day}`);
    const hit = byDate.get(iso);
    cells.push({
      date: iso,
      day_int,
      filled: !!hit,
      score: hit?.day_score ?? null,
      color: hit?.day_color || "",
      emoji: hit?.day_emoji || "",
    });
  }
  return cells;
}

export function monthLabel(monthInt: number): string {
  const s = String(monthInt);
  const y = s.slice(0, 4);
  const m = Number(s.slice(4));
  const d = new Date(Number(y), m - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
