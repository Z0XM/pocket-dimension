import { describe, expect, test } from "bun:test";
import {
  documentToHtml,
  documentToPlainTextWithBreaks,
  normalizeMark,
  plainTextToDocument,
  splitDocumentPages,
} from "./document";

describe("document model", () => {
  test("plainTextToDocument treats --- as page breaks", () => {
    const document = plainTextToDocument("Page one\n\nPage two\n---\n\nPage three");
    expect(splitDocumentPages(document)).toEqual(["Page one\n\nPage two", "Page three"]);
  });

  test("document round-trips through plain text with breaks", () => {
    const source = "First page\n\nStill first\n---\n\nSecond page";
    const document = plainTextToDocument(source);
    expect(documentToPlainTextWithBreaks(document)).toBe(source);
  });

  test("documentToHtml preserves inline marks", () => {
    const document = plainTextToDocument("hello");
    const paragraph = document.content[0];
    if (paragraph.type !== "paragraph") throw new Error("expected paragraph");
    paragraph.children[0] = {
      type: "text",
      text: "styled",
      marks: { color: "#ff0000", fontFamily: "serif", fontSize: "1.25rem" },
    };

    expect(documentToHtml(document)).toContain('style="color:#ff0000');
    expect(documentToHtml(document)).toContain("font-family:serif");
  });

  test("normalizeMark rejects invalid colors", () => {
    expect(normalizeMark({ color: "red" })).toBeUndefined();
    expect(normalizeMark({ color: "#abc" })?.color).toBe("#abc");
  });
});
