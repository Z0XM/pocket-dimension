import type { ReactNode } from "react";

const BOLD_RE = /\*\*([^*]+)\*\*/g;

/** Render `**bold**` segments in plain-text titles as <strong>. */
export function inlineMarkdown(text: string): ReactNode {
  if (!text.includes("**")) return text;

  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(BOLD_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) nodes.push(text.slice(lastIndex, index));
    nodes.push(<strong key={index}>{match[1]}</strong>);
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes.length === 1 ? nodes[0] : <>{nodes}</>;
}

/** Plain text for HTML title attributes and search keys. */
export function stripInlineMarkdown(text: string): string {
  return text.replace(BOLD_RE, "$1");
}
