const BLOCKED_TAGS = /<\/?(?:script|style|iframe|object|embed|form|input|button|link|meta)[^>]*>/gi;
const ON_EVENT_ATTRS = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JAVASCRIPT_URLS = /\s+(?:href|src)\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi;

export function sanitizeHtml(html: string): string {
  return html.replace(BLOCKED_TAGS, "").replace(ON_EVENT_ATTRS, "").replace(JAVASCRIPT_URLS, "");
}

export async function renderSourceToHtml(source: string, mode: "plain" | "markdown" | "html"): Promise<string> {
  if (mode === "html") {
    return sanitizeHtml(source);
  }

  if (mode === "markdown") {
    const { marked } = await import("marked");
    marked.setOptions({ breaks: true, gfm: true });
    return sanitizeHtml(marked.parse(source) as string);
  }

  return source
    .split("\n")
    .map((line) => line.trim())
    .map((line) => (line.length > 0 ? `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>` : ""))
    .join("");
}
