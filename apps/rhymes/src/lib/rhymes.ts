export type ContentType = "poem" | "article" | "song" | "diary";
export type ContentVisibility = "public" | "hidden" | "draft";
export type ReaderMode = "continuous" | "paged";

export interface RhymeFrontmatter {
  title?: string;
  thought_on?: string;
  order?: number;
  rating?: number;
  tags?: string[];
  status?: string;
  phase?: string;
  content_type?: ContentType;
  visibility?: ContentVisibility;
  reader_mode?: ReaderMode;
  title_art?: string;
  [key: string]: unknown;
}

export interface Rhyme {
  id: string;
  slug: string;
  content: string;
  pages: string[];
  contentType: ContentType;
  visibility: ContentVisibility;
  defaultReaderMode: ReaderMode;
  summary: string;
  frontmatter: RhymeFrontmatter;
}

interface ParsedMarkdownModule {
  frontmatter: Record<string, unknown>;
}

interface RawMarkdownModule {
  default: string;
}

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
const PAGE_BREAK_REGEX = /\n---\s*\n/g;
const CONTENT_TYPES: ContentType[] = ["poem", "article", "song", "diary"];
const VISIBILITY_VALUES: ContentVisibility[] = ["public", "hidden", "draft"];
const READER_MODES: ReaderMode[] = ["continuous", "paged"];

function parseOrder(frontmatter: RhymeFrontmatter, rawDocument: string): number | undefined {
  let order = frontmatter.order;

  if ((order === undefined || order === null) && rawDocument) {
    const match = rawDocument.match(FRONTMATTER_REGEX);
    const frontmatterText = match?.[1];
    const orderMatch = frontmatterText?.match(/^order:\s*(.+?)(?:\n|$)/m);

    if (orderMatch) {
      const orderValue = orderMatch[1].trim().replace(/^['"]|['"]$/g, "");
      const parsedOrder = Number(orderValue);

      if (!Number.isNaN(parsedOrder)) {
        order = parsedOrder;
      }
    }
  }

  if (order === undefined || order === null) {
    return undefined;
  }

  const numericOrder = Number(order);
  return Number.isNaN(numericOrder) ? undefined : numericOrder;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function deriveSlug(title: string, order: number | undefined, path: string): string {
  const baseSlug = slugify(title) || slugify(path.split("/").pop()?.replace(/\.md$/i, "") || path) || "piece";

  if (order !== undefined) {
    return `${baseSlug}-${order}`;
  }

  return baseSlug;
}

function deriveContentType(frontmatter: RhymeFrontmatter): ContentType {
  if (typeof frontmatter.content_type === "string" && CONTENT_TYPES.includes(frontmatter.content_type as ContentType)) {
    return frontmatter.content_type as ContentType;
  }

  const normalizedTags = (frontmatter.tags ?? []).map((tag) => tag.toLowerCase());

  if (normalizedTags.includes("article")) return "article";
  if (normalizedTags.includes("song")) return "song";
  if (normalizedTags.includes("diary")) return "diary";

  return "poem";
}

function deriveVisibility(frontmatter: RhymeFrontmatter): ContentVisibility {
  if (typeof frontmatter.visibility === "string" && VISIBILITY_VALUES.includes(frontmatter.visibility as ContentVisibility)) {
    return frontmatter.visibility as ContentVisibility;
  }

  return "public";
}

function splitPages(content: string): string[] {
  const normalizedContent = content.trim();

  if (!normalizedContent) {
    return [];
  }

  return normalizedContent
    .split(PAGE_BREAK_REGEX)
    .map((page) => page.trim())
    .filter((page) => page.length > 0);
}

function deriveReaderMode(frontmatter: RhymeFrontmatter): ReaderMode {
  if (typeof frontmatter.reader_mode === "string" && READER_MODES.includes(frontmatter.reader_mode as ReaderMode)) {
    return frontmatter.reader_mode as ReaderMode;
  }

  return "continuous";
}

function deriveSummary(content: string): string {
  return (
    content
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0)
      ?.slice(0, 96) ?? ""
  );
}

function extractContent(rawDocument: string): string {
  const match = rawDocument.match(FRONTMATTER_REGEX);
  return match ? match[2].trim() : rawDocument.trim();
}

export function parseRhymes(
  rhymeModules: Record<string, unknown>,
  rawRhymeModules: Record<string, unknown>
): Rhyme[] {
  return Object.keys(rhymeModules)
    .map((path) => {
      const parsed = rhymeModules[path] as ParsedMarkdownModule;
      const raw = rawRhymeModules[path] as RawMarkdownModule;
      const content = extractContent(raw.default);
      const frontmatter = parsed.frontmatter as RhymeFrontmatter;
      const order = parseOrder(frontmatter, raw.default);
      const title = frontmatter.title?.trim() || `Untitled ${order ?? path}`;
      const pages = splitPages(content);

      return {
        id: path,
        slug: deriveSlug(title, order, path),
        content,
        pages,
        contentType: deriveContentType(frontmatter),
        visibility: deriveVisibility(frontmatter),
        defaultReaderMode: deriveReaderMode(frontmatter),
        summary: deriveSummary(content),
        frontmatter: {
          ...frontmatter,
          order,
          title,
        },
      } satisfies Rhyme;
    })
    .filter((rhyme) => rhyme.visibility !== "draft" && rhyme.visibility !== "hidden")
    .sort((a, b) => {
      const orderA = a.frontmatter.order ?? 0;
      const orderB = b.frontmatter.order ?? 0;
      return orderB - orderA;
    });
}
