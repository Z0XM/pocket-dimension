export type SourceMode = "plain" | "markdown" | "html";

export interface TextMark {
  color?: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontSize?: string;
}

export interface TextNode {
  type: "text";
  text: string;
  marks?: TextMark;
}

export interface ParagraphNode {
  type: "paragraph";
  children: TextNode[];
}

export interface PageBreakNode {
  type: "pageBreak";
}

export type DocumentNode = ParagraphNode | PageBreakNode;

export interface BodyDocument {
  type: "doc";
  content: DocumentNode[];
}

export interface TitleRichStyle {
  color?: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontSize?: string;
}

const ALLOWED_FONT_FAMILIES = new Set([
  "inherit",
  "serif",
  "sans-serif",
  "monospace",
  "var(--font-heading)",
  "var(--font-content)",
]);
const ALLOWED_FONT_SIZES = new Set(["0.875rem", "1rem", "1.125rem", "1.25rem", "1.5rem", "2rem"]);

export function normalizeMark(mark: TextMark | undefined): TextMark | undefined {
  if (!mark) return undefined;

  const normalized: TextMark = {};

  if (mark.color && /^#[0-9a-fA-F]{3,8}$/.test(mark.color)) {
    normalized.color = mark.color;
  }

  if (mark.backgroundColor && /^#[0-9a-fA-F]{3,8}$/.test(mark.backgroundColor)) {
    normalized.backgroundColor = mark.backgroundColor;
  }

  if (mark.fontFamily && ALLOWED_FONT_FAMILIES.has(mark.fontFamily)) {
    normalized.fontFamily = mark.fontFamily;
  }

  if (mark.fontSize && ALLOWED_FONT_SIZES.has(mark.fontSize)) {
    normalized.fontSize = mark.fontSize;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function plainTextToDocument(text: string): BodyDocument {
  const pageBlocks = text.split(/\n---\s*\n/);
  const content: DocumentNode[] = [];

  pageBlocks.forEach((pageBlock, pageIndex) => {
    const paragraphs = pageBlock
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);

    for (const paragraph of paragraphs) {
      content.push({
        type: "paragraph",
        children: [{ type: "text", text: paragraph }],
      });
    }

    if (pageIndex < pageBlocks.length - 1) {
      content.push({ type: "pageBreak" });
    }
  });

  return { type: "doc", content };
}

export function documentToPlainText(document: BodyDocument): string {
  const parts: string[] = [];

  for (const node of document.content) {
    if (node.type === "paragraph") {
      parts.push(node.children.map((child) => child.text).join(""));
    }
  }

  return parts.join("\n\n");
}

export function documentToPlainTextWithBreaks(document: BodyDocument): string {
  const pages: string[] = [];
  let currentParagraphs: string[] = [];

  const flushPage = () => {
    if (currentParagraphs.length === 0) return;
    pages.push(currentParagraphs.join("\n\n"));
    currentParagraphs = [];
  };

  for (const node of document.content) {
    if (node.type === "pageBreak") {
      flushPage();
      continue;
    }

    currentParagraphs.push(node.children.map((child) => child.text).join(""));
  }

  flushPage();
  return pages.join("\n---\n\n");
}

export function splitDocumentPages(document: BodyDocument): string[] {
  const pages: string[] = [];
  let current: string[] = [];

  for (const node of document.content) {
    if (node.type === "pageBreak") {
      if (current.length > 0) {
        pages.push(current.join("\n\n"));
        current = [];
      }
      continue;
    }

    current.push(node.children.map((child) => child.text).join(""));
  }

  if (current.length > 0) {
    pages.push(current.join("\n\n"));
  }

  return pages.filter((page) => page.trim().length > 0);
}

export function insertPageBreakAtEnd(document: BodyDocument): BodyDocument {
  return {
    type: "doc",
    content: [...document.content, { type: "pageBreak" }],
  };
}

export function renderTextNode(node: TextNode): string {
  const escaped = node.text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const mark = normalizeMark(node.marks);
  if (!mark) {
    return escaped;
  }

  const styles: string[] = [];
  if (mark.color) styles.push(`color:${mark.color}`);
  if (mark.backgroundColor) styles.push(`background-color:${mark.backgroundColor}`);
  if (mark.fontFamily) styles.push(`font-family:${mark.fontFamily}`);
  if (mark.fontSize) styles.push(`font-size:${mark.fontSize}`);

  return `<span style="${styles.join(";")}">${escaped}</span>`;
}

export function documentToHtml(document: BodyDocument): string {
  const chunks: string[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    chunks.push(`<p>${paragraphBuffer.join("<br />")}</p>`);
    paragraphBuffer = [];
  };

  for (const node of document.content) {
    if (node.type === "pageBreak") {
      flushParagraph();
      chunks.push("<hr data-page-break />");
      continue;
    }

    paragraphBuffer.push(node.children.map((child) => renderTextNode(child)).join(""));
  }

  flushParagraph();
  return chunks.join("");
}

export function documentToEditorHtml(document: BodyDocument): string {
  if (document.content.length === 0) {
    return "<p><br></p>";
  }

  return documentToHtml(document);
}

function markFromStyleAttribute(style: string | null | undefined): TextMark | undefined {
  if (!style) return undefined;

  const mark: TextMark = {};
  for (const rule of style.split(";")) {
    const [rawKey, rawValue] = rule.split(":");
    if (!rawKey || !rawValue) continue;
    const key = rawKey.trim().toLowerCase();
    const value = rawValue.trim();
    if (key === "color") mark.color = value;
    if (key === "background-color") mark.backgroundColor = value;
    if (key === "font-family") mark.fontFamily = value.replace(/^['"]|['"]$/g, "");
    if (key === "font-size") mark.fontSize = value;
  }

  return normalizeMark(mark);
}

function parseInlineNodes(node: Node): TextNode[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    return text ? [{ type: "text", text }] : [];
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return [];
  }

  const element = node as HTMLElement;
  if (element.tagName === "BR") {
    return [{ type: "text", text: "\n" }];
  }

  const mark =
    element.tagName === "SPAN"
      ? markFromStyleAttribute(element.getAttribute("style"))
      : element.tagName === "FONT"
        ? normalizeMark({
            color: element.getAttribute("color") ?? undefined,
            fontFamily: element.getAttribute("face") ?? undefined,
          })
        : undefined;

  const children = Array.from(element.childNodes).flatMap((child) => parseInlineNodes(child));
  if (!mark) return children;

  return children.map((child) => ({
    ...child,
    marks: normalizeMark({ ...mark, ...child.marks }),
  }));
}

export function editorHtmlToDocument(html: string): BodyDocument {
  if (typeof document === "undefined") {
    return plainTextToDocument(html);
  }

  const container = document.createElement("div");
  container.innerHTML = html;
  const content: DocumentNode[] = [];

  for (const child of Array.from(container.childNodes)) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const element = child as HTMLElement;

    if (element.tagName === "HR") {
      content.push({ type: "pageBreak" });
      continue;
    }

    if (element.tagName === "P" || element.tagName === "DIV") {
      const textNodes = Array.from(element.childNodes).flatMap((node) => parseInlineNodes(node));
      if (textNodes.length > 0) {
        content.push({ type: "paragraph", children: textNodes });
      }
    }
  }

  return { type: "doc", content };
}

export function renderTitleStyle(style: TitleRichStyle | null | undefined): string {
  if (!style) return "";

  const styles: string[] = [];
  if (style.color) styles.push(`color:${style.color}`);
  if (style.backgroundColor) styles.push(`background-color:${style.backgroundColor}`);
  if (style.fontFamily) styles.push(`font-family:${style.fontFamily}`);
  if (style.fontSize) styles.push(`font-size:${style.fontSize}`);

  return styles.join(";");
}
