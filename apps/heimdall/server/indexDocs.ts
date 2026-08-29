import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { HeimdallConfig } from "../src/config/schema.js";
import type { DocCatalog, DocCategory, DocRecord } from "./types.js";

function categorize(relativePath: string): { category: DocCategory; section?: string } {
  if (relativePath === "project-context.md" || relativePath.endsWith("/project-context.md")) {
    return { category: "project" };
  }
  if (relativePath.includes("requirements/intake/")) {
    return { category: "requirements", section: "intake" };
  }
  if (relativePath.includes("requirements/")) {
    return { category: "requirements", section: "registry" };
  }
  if (relativePath.includes("planning/architecture/") || relativePath.includes("/architecture/")) {
    return { category: "planning", section: "architecture" };
  }
  if (relativePath.includes("planning/prds/") || relativePath.includes("/prds/")) {
    return { category: "planning", section: "prds" };
  }
  if (relativePath.includes("planning/ux/") || relativePath.includes("/heimdall/ux")) {
    return { category: "planning", section: "ux" };
  }
  if (relativePath.includes("planning/epics/") || relativePath.includes("/epics")) {
    return { category: "planning", section: "epics" };
  }
  if (relativePath.includes("planning/") || relativePath.includes("_bmad-output/")) {
    return { category: "planning" };
  }
  if (relativePath.includes("implementation/")) {
    return { category: "implementation" };
  }
  return { category: "project" };
}

function extractTitle(content: string, filename: string): string {
  const h1 = content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return filename.replace(/\.md$/, "").replace(/-/g, " ");
}

function extractHeadings(content: string): string {
  const headings = content.match(/^#{1,3}\s+.+$/gm) ?? [];
  return headings.map((h) => h.replace(/^#+\s+/, "")).join(" ");
}

function extractReferences(content: string): {
  relatedStoryIds: string[];
  relatedFeatureIds: string[];
} {
  const storyMatches = content.match(/Story\s+(\d+\.\d+)/g)?.map((s) => s.replace("Story ", "").replace(".", "-")) ?? [];
  const featureMatches = content.match(/F-\d+/g) ?? [];
  return {
    relatedStoryIds: [...new Set(storyMatches)],
    relatedFeatureIds: [...new Set(featureMatches)],
  };
}

function shouldIgnore(rel: string, ignoreGlobs: string[]): boolean {
  for (const glob of ignoreGlobs) {
    if (glob.includes("node_modules") && rel.includes("node_modules")) return true;
    if (glob.includes(".git") && rel.includes(".git")) return true;
  }
  return false;
}

function walkDocs(dir: string, rootDir: string, pathPrefix: string, docs: DocRecord[], ignoreGlobs: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".git" || entry === "dist") continue;
    const fullPath = join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      walkDocs(fullPath, rootDir, pathPrefix, docs, ignoreGlobs);
      continue;
    }

    const rel = relative(rootDir, fullPath).replace(/\\/g, "/");
    if (shouldIgnore(rel, ignoreGlobs)) continue;
    const docPath = pathPrefix ? `${pathPrefix}/${rel}` : rel;

    if (entry.endsWith(".md")) {
      const content = readFileSync(fullPath, "utf-8");
      const { category, section } = categorize(docPath);
      const refs = extractReferences(content);

      docs.push({
        path: docPath,
        title: extractTitle(content, entry),
        category,
        section,
        wordCount: content.split(/\s+/).length,
        modifiedAt: stat.mtime.toISOString(),
        relatedStoryIds: refs.relatedStoryIds,
        relatedFeatureIds: refs.relatedFeatureIds,
      });
    } else if (entry.endsWith(".yaml") || entry.endsWith(".yml")) {
      const { category, section } = categorize(docPath);
      docs.push({
        path: docPath,
        title: entry,
        category,
        section,
        wordCount: 0,
        modifiedAt: stat.mtime.toISOString(),
        relatedStoryIds: [],
        relatedFeatureIds: [],
        isYaml: true,
      });
    }
  }
}

export function indexDocs(repoRoot: string, config: HeimdallConfig): DocCatalog {
  const docs: DocRecord[] = [];
  const docsRoot = join(repoRoot, config.paths.docsRoot);
  walkDocs(docsRoot, docsRoot, config.paths.docsRoot, docs, config.docs.ignoreGlobs);

  for (const extra of config.docs.extraRoots) {
    const abs = join(repoRoot, extra);
    walkDocs(abs, abs, extra.replace(/\/$/, ""), docs, config.docs.ignoreGlobs);
  }

  docs.sort((a, b) => a.path.localeCompare(b.path));

  return {
    docs,
    generatedAt: new Date().toISOString(),
  };
}

export function readDocContent(repoRoot: string, docPath: string, _config?: HeimdallConfig): string {
  const fullPath = join(repoRoot, docPath);
  return readFileSync(fullPath, "utf-8");
}

export function getDocHeadingsAndBody(content: string): { headings: string; body: string } {
  return {
    headings: extractHeadings(content),
    body: content,
  };
}

export function buildSearchDocuments(
  repoRoot: string,
  catalog: DocCatalog,
  config: HeimdallConfig
): Array<{
  id: string;
  path: string;
  title: string;
  category: DocCategory;
  section?: string;
  headings: string;
  body: string;
}> {
  return catalog.docs
    .filter((d) => !d.isYaml)
    .map((doc) => {
      const content = readDocContent(repoRoot, doc.path, config);
      const { headings, body } = getDocHeadingsAndBody(content);
      return {
        id: doc.path,
        path: doc.path,
        title: doc.title,
        category: doc.category,
        section: doc.section,
        headings,
        body,
      };
    });
}
