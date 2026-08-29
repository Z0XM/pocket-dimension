import MiniSearch from "minisearch";
import type { DocCategory, SearchResult } from "./types.js";

export interface SearchDocument {
  id: string;
  path: string;
  title: string;
  category: DocCategory;
  section?: string;
  headings: string;
  body: string;
}

export class DocSearchIndex {
  private index: MiniSearch<SearchDocument>;

  constructor() {
    this.index = new MiniSearch<SearchDocument>({
      fields: ["title", "headings", "body", "path"],
      storeFields: ["path", "title", "category", "section", "body"],
      searchOptions: {
        boost: { title: 3, headings: 2, path: 1.5 },
        fuzzy: 0.2,
        prefix: true,
      },
    });
  }

  rebuild(documents: SearchDocument[]): void {
    this.index.removeAll();
    const seen = new Set<string>();
    const unique: SearchDocument[] = [];
    for (const doc of documents) {
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);
      unique.push(doc);
    }
    this.index.addAll(unique);
  }

  search(query: string, limit = 30): SearchResult[] {
    const trimmed = query.trim();
    if (!trimmed) return [];

    let filterQuery = trimmed;
    let categoryFilter: DocCategory | undefined;
    let storyFilter: string | undefined;
    let extFilter: string | undefined;

    const catMatch = trimmed.match(/cat:(\w+)/i);
    if (catMatch) {
      categoryFilter = catMatch[1].toLowerCase() as DocCategory;
      filterQuery = trimmed.replace(/cat:\w+/gi, "").trim();
    }

    const storyMatch = trimmed.match(/story:(\d+\.?\d*)/i);
    if (storyMatch) {
      storyFilter = storyMatch[1].replace(".", "-");
      filterQuery = trimmed.replace(/story:\S+/gi, "").trim();
    }

    const extMatch = trimmed.match(/ext:(EXT-\d+)/i);
    if (extMatch) {
      extFilter = extMatch[1].toUpperCase();
      filterQuery = trimmed.replace(/ext:\S+/gi, "").trim();
    }

    const searchTerm = filterQuery || trimmed;
    const rawResults = searchTerm.length > 0 ? this.index.search(searchTerm, { combineWith: "AND" }) : this.index.search("", { prefix: true });

    const results: SearchResult[] = [];

    for (const hit of rawResults) {
      const doc = hit as unknown as SearchDocument & { score: number };
      if (!doc.path || !doc.title) continue;
      if (categoryFilter && doc.category !== categoryFilter) continue;
      if (storyFilter && !doc.body.includes(storyFilter) && !doc.path.includes(storyFilter)) continue;
      if (extFilter && !doc.body.includes(extFilter)) continue;

      results.push({
        path: doc.path,
        title: doc.title,
        category: doc.category,
        score: hit.score,
        snippets: extractSnippets(doc.body, searchTerm || extFilter || storyFilter || trimmed),
      });

      if (results.length >= limit) break;
    }

    return results;
  }
}

function extractSnippets(body: string, term: string, maxSnippets = 2): string[] {
  if (!term) return [];
  const lines = body.split("\n");
  const snippets: string[] = [];
  const lowerTerm = term.toLowerCase();

  for (const line of lines) {
    if (line.toLowerCase().includes(lowerTerm)) {
      const trimmed = line.trim().slice(0, 160);
      if (trimmed) snippets.push(trimmed);
      if (snippets.length >= maxSnippets) break;
    }
  }

  if (snippets.length === 0 && body.length > 0) {
    snippets.push(body.slice(0, 120).trim() + "…");
  }

  return snippets;
}
