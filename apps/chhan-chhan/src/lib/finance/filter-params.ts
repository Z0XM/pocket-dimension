export function parseMultiFilterParam(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean)
    ),
  ];
}

export function serializeMultiFilterParam(values: Iterable<string>): string {
  return [...values].join(",");
}

export function filterValidIds(values: string[], allowed: Set<string>): string[] {
  return values.filter((value) => allowed.has(value));
}
