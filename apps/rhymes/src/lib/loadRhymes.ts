import { parseRhymes, type Rhyme } from "./rhymes";

export function loadRhymes(): Rhyme[] {
  const rawRhymeModules = import.meta.glob("../assets/rhymes/*.md", {
    eager: true,
    query: "?raw",
    import: "default",
  }) as Record<string, string>;

  return parseRhymes(rawRhymeModules);
}
