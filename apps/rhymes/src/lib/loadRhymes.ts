import { parseRhymes, type Rhyme } from "./rhymes";

export function loadRhymes(): Rhyme[] {
  const rhymeModules = import.meta.glob("../assets/rhymes/*.md", { eager: true });
  const rawRhymeModules = import.meta.glob("../assets/rhymes/*.md", {
    eager: true,
    query: "?raw",
  });

  return parseRhymes(rhymeModules, rawRhymeModules);
}
