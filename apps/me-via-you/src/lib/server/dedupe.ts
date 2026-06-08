export type DedupedAnswer = {
  text: string;
  count: number;
  expandDetails: string[];
};

export type DedupedAnswerInput = {
  primaryAnswer: string;
  expandDetail?: string | null;
};

export function normalizeAnswer(text: string): string {
  return text.trim().toLowerCase();
}

export function dedupeAnswers(answers: DedupedAnswerInput[]): DedupedAnswer[] {
  const counts = new Map<string, { text: string; count: number; expandDetails: Set<string> }>();

  for (const answer of answers) {
    const trimmed = answer.primaryAnswer.trim();
    if (!trimmed) continue;

    const key = normalizeAnswer(trimmed);
    const existing = counts.get(key);
    const expandDetail = answer.expandDetail?.trim();

    if (existing) {
      existing.count += 1;
      if (expandDetail) {
        existing.expandDetails.add(expandDetail);
      }
    } else {
      const expandDetails = new Set<string>();
      if (expandDetail) {
        expandDetails.add(expandDetail);
      }
      counts.set(key, { text: trimmed, count: 1, expandDetails });
    }
  }

  return Array.from(counts.values())
    .map(({ text, count, expandDetails }) => ({
      text,
      count,
      expandDetails: Array.from(expandDetails),
    }))
    .sort((a, b) => b.count - a.count);
}
