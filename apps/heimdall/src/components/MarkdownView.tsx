import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import { headingSlug } from "@/lib/hashScroll";

interface MarkdownViewProps {
  content: string;
}

function resolveDocLink(href: string): string | null {
  if (!href || href.startsWith("http") || href.startsWith("#")) return null;
  if (href.endsWith(".md")) {
    const normalized = href.startsWith("docs/") ? href : href.startsWith("_bmad-output/") ? href : `docs/${href.replace(/^\.\.\//, "")}`;
    return `/browse?path=${encodeURIComponent(normalized)}`;
  }
  return null;
}

function Heading({ as: Tag, children }: { as: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"; children?: ReactNode }) {
  const text = flattenText(children);
  const id = headingSlug(text);
  const upper = text.trim().toUpperCase();
  return (
    <Tag id={id} data-hash={upper}>
      {children}
    </Tag>
  );
}

function flattenText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  if (typeof node === "object" && node !== null && "props" in node) {
    return flattenText((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

export function MarkdownView({ content }: MarkdownViewProps) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <Heading as="h1">{children}</Heading>,
          h2: ({ children }) => <Heading as="h2">{children}</Heading>,
          h3: ({ children }) => <Heading as="h3">{children}</Heading>,
          h4: ({ children }) => <Heading as="h4">{children}</Heading>,
          h5: ({ children }) => <Heading as="h5">{children}</Heading>,
          h6: ({ children }) => <Heading as="h6">{children}</Heading>,
          a: ({ href, children }) => {
            if (href?.startsWith("#")) {
              return <a href={href}>{children}</a>;
            }
            const docLink = href ? resolveDocLink(href) : null;
            if (docLink) {
              return <Link to={docLink}>{children}</Link>;
            }
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
