export function normalizeMerchant(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }

  return matrix[a.length][b.length];
}

export function merchantSimilarity(left: string, right: string): number {
  const a = normalizeMerchant(left);
  const b = normalizeMerchant(right);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (shorter.length >= 4 && longer.includes(shorter)) {
    return Math.max(shorter.length / longer.length, 0.75);
  }

  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

export function isFuzzyMerchantMatch(source: string, candidate: string, threshold = 0.72): boolean {
  const normalizedSource = normalizeMerchant(source);
  const normalizedCandidate = normalizeMerchant(candidate);
  if (!normalizedSource || !normalizedCandidate) return false;
  if (normalizedSource === normalizedCandidate) return false;
  return merchantSimilarity(source, candidate) >= threshold;
}

export function rankFuzzyMerchants(source: string, merchants: string[], limit = 8): string[] {
  return merchants
    .filter((merchant) => isFuzzyMerchantMatch(source, merchant))
    .map((merchant) => ({ merchant, score: merchantSimilarity(source, merchant) }))
    .sort((a, b) => b.score - a.score || a.merchant.localeCompare(b.merchant))
    .slice(0, limit)
    .map((entry) => entry.merchant);
}
