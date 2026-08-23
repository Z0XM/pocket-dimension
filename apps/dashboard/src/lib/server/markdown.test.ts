import { describe, expect, it } from "bun:test";
import { sanitizeMarkdown } from "./markdown";

describe("sanitizeMarkdown", () => {
  it("preserves heading ranks", () => {
    const html = sanitizeMarkdown("# Title\n\n## Section\n\n### Sub");
    expect(html).toContain("<h1");
    expect(html).toContain("Title");
    expect(html).toContain("<h2");
    expect(html).toContain("Section");
    expect(html).toContain("<h3");
    expect(html).toContain("Sub");
  });

  it("renders GFM tables", () => {
    const html = sanitizeMarkdown("| A | B |\n| --- | --- |\n| 1 | 2 |");
    expect(html).toContain("<table");
    expect(html).toContain("<td");
  });

  it("renders lists", () => {
    const ul = sanitizeMarkdown("- one\n- two");
    expect(ul).toContain("<ul");
    expect(ul).toContain("<li");

    const ol = sanitizeMarkdown("1. first\n2. second");
    expect(ol).toContain("<ol");
  });

  it("renders emphasis", () => {
    const html = sanitizeMarkdown("*em* **strong**");
    expect(html).toContain("<em");
    expect(html).toContain("<strong");
  });

  it("keeps safe https links", () => {
    const html = sanitizeMarkdown("[docs](https://example.com/docs)");
    expect(html).toContain('href="https://example.com/docs"');
    expect(html).toContain("docs");
  });

  it("strips script tags and event handlers", () => {
    const html = sanitizeMarkdown('# Title\n\n<script>alert("xss")</script>\n\n[bad](javascript:alert(1))\n\n<div onclick="evil()">click</div>');
    expect(html.toLowerCase()).not.toContain("<script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("javascript:");
  });

  it("does not dump raw markdown as plain pre for simple document", () => {
    const html = sanitizeMarkdown("# Title\n\nA paragraph.");
    expect(html).toContain("<h1");
    expect(html).not.toMatch(/^<pre># Title/m);
  });
});
