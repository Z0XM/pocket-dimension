import { describe, expect, it } from "bun:test";
import { sanitizeMarkdown } from "./markdown";

const TREE = "pocket-dimension" as const;
const SOURCE = "planning-artifacts/epics-dashboard.md";

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

  it("rewrites relative sibling links to Reader URLs with tree param", () => {
    const html = sanitizeMarkdown("[arch](./architecture-dashboard.md)", {
      sourcePath: SOURCE,
      tree: TREE,
    });
    expect(html).toContain('href="/docs/planning-artifacts/architecture-dashboard.md?tree=pocket-dimension"');
    expect(html).toContain("arch");
  });

  it("marks escape links unresolved without outbound href", () => {
    const html = sanitizeMarkdown("[outside](../../../../outside.md)", {
      sourcePath: "planning-artifacts/prds/foo/prd.md",
      tree: TREE,
    });
    expect(html).toContain("outside");
    expect(html).toContain('data-unresolved="true"');
    expect(html).not.toContain('href="/docs/');
    expect(html).not.toContain("outside.md");
  });

  it("marks missing files unresolved while keeping link text", () => {
    const html = sanitizeMarkdown("[missing](missing.md)", {
      sourcePath: SOURCE,
      tree: TREE,
      exists: () => false,
    });
    expect(html).toContain("missing");
    expect(html).toContain('data-unresolved="true"');
    expect(html).not.toMatch(/href="[^"]*missing\.md/);
  });

  it("assigns heading ids and preserves hash links", () => {
    const html = sanitizeMarkdown("## Heading\n\n[section](#heading)", {
      sourcePath: SOURCE,
      tree: TREE,
    });
    expect(html).toContain('id="heading"');
    expect(html).toContain('href="#heading"');
  });

  it("keeps javascript links non-executable after sanitize and resolve", () => {
    const html = sanitizeMarkdown("[bad](javascript:alert(1))", {
      sourcePath: SOURCE,
      tree: TREE,
    });
    expect(html).not.toContain("javascript:");
    expect(html).toContain("bad");
  });

  it("keeps https external links unchanged", () => {
    const html = sanitizeMarkdown("[docs](https://example.com/docs)", {
      sourcePath: SOURCE,
      tree: TREE,
    });
    expect(html).toContain('href="https://example.com/docs"');
  });
});
