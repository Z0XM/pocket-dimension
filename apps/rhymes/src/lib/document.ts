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

const ALLOWED_FONT_FAMILIES = new Set(["inherit", "serif", "sans-serif", "monospace", "var(--font-heading)", "var(--font-content)"]);
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
  const paragraphs = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  if (paragraphs.length === 0) {
    return { type: "doc", content: [] };
  }

  return {
    type: "doc",
    content: paragraphs.flatMap((paragraph, index) => {
      const nodes: DocumentNode[] = [
        {
          type: "paragraph",
          children: [{ type: "text", text: paragraph }],
        },
      ];

      if (index < paragraphs.length - 1) {
        nodes.push({ type: "pageBreak" });
      }

      return nodes;
    }),
  };
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

export function renderTitleStyle(style: TitleRichStyle | null | undefined): string {
  if (!style) return "";

  const styles: string[] = [];
  if (style.color) styles.push(`color:${style.color}`);
  if (style.backgroundColor) styles.push(`background-color:${style.backgroundColor}`);
  if (style.fontFamily) styles.push(`font-family:${style.fontFamily}`);
  if (style.fontSize) styles.push(`font-size:${style.fontSize}`);

  return styles.join(";");
}
