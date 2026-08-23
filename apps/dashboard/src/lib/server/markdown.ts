import { slugifyHeading } from "$lib/catalog/heading-slug";
import { resolveLink } from "$lib/catalog/resolve-link";
import type { TreeId } from "$lib/types";
import type { Element, Root } from "hast";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";

export type SanitizeMarkdownContext = {
  sourcePath: string;
  tree: TreeId;
  exists?: (normalizedTreeRelativePath: string) => boolean;
};

function hastToPlainText(node: unknown): string {
  if (!node || typeof node !== "object") {
    return "";
  }
  if ("type" in node && node.type === "text" && "value" in node && typeof node.value === "string") {
    return node.value;
  }
  if ("children" in node && Array.isArray(node.children)) {
    return node.children.map((child) => hastToPlainText(child)).join("");
  }
  return "";
}

function assignHeadingIds(tree: Root): void {
  const usedIds = new Set<string>();

  visit(tree, "element", (node: Element) => {
    if (!/^h[1-6]$/.test(node.tagName)) {
      return;
    }

    const existingId = node.properties?.id;
    if (typeof existingId === "string" && existingId.length > 0) {
      usedIds.add(existingId);
      return;
    }

    const base = slugifyHeading(hastToPlainText(node));
    if (!base) {
      return;
    }

    let candidate = base;
    let suffix = 1;
    while (usedIds.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }

    usedIds.add(candidate);
    node.properties = { ...node.properties, id: candidate };
  });
}

function applyLinkResolution(tree: Root, ctx: SanitizeMarkdownContext): void {
  visit(tree, "element", (node: Element) => {
    if (node.tagName !== "a") {
      return;
    }

    const href = node.properties?.href;
    if (typeof href !== "string" || href.length === 0) {
      return;
    }

    const result = resolveLink({
      href,
      sourcePath: ctx.sourcePath,
      tree: ctx.tree,
      exists: ctx.exists,
    });

    if ("unresolved" in result && result.unresolved) {
      const nextProperties = { ...node.properties };
      delete nextProperties.href;
      nextProperties["data-unresolved"] = "true";
      nextProperties.className = mergeClassNames(nextProperties.className, "unresolved-link");
      nextProperties.role = "link";
      nextProperties["aria-disabled"] = "true";
      nextProperties.title = "Unresolved link";
      node.properties = nextProperties;
      return;
    }

    node.properties = { ...node.properties, href: result.href };
  });
}

function mergeClassNames(existing: unknown, extra: string): string[] {
  const parts = new Set<string>();
  if (typeof existing === "string") {
    for (const token of existing.split(/\s+/)) {
      if (token) {
        parts.add(token);
      }
    }
  } else if (Array.isArray(existing)) {
    for (const token of existing) {
      if (typeof token === "string" && token) {
        parts.add(token);
      }
    }
  }
  parts.add(extra);
  return [...parts];
}

function rehypePostProcess(ctx?: SanitizeMarkdownContext) {
  return (tree: Root) => {
    assignHeadingIds(tree);
    if (ctx) {
      applyLinkResolution(tree, ctx);
    }
  };
}

function createProcessor(ctx?: SanitizeMarkdownContext) {
  return unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeSanitize).use(rehypePostProcess, ctx).use(rehypeStringify);
}

/** Parse markdown to sanitized HTML for safe `{@html}` rendering. */
export function sanitizeMarkdown(source: string, ctx?: SanitizeMarkdownContext): string {
  const file = createProcessor(ctx).processSync(source);
  return String(file);
}
