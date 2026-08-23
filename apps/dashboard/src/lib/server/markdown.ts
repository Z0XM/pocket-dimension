import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeSanitize).use(rehypeStringify);

/** Parse markdown to sanitized HTML for safe `{@html}` rendering. */
export function sanitizeMarkdown(source: string): string {
  const file = processor.processSync(source);
  return String(file);
}
