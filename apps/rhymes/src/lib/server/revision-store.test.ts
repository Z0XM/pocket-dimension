import { describe, expect, test } from "bun:test";
import { pieceToRevisionSnapshot } from "./revision-store";
import type { DbPiece } from "./pieces";

describe("revision snapshots", () => {
  test("pieceToRevisionSnapshot captures editable fields", () => {
    const piece = {
      titleText: "Title",
      bodyPlain: "Body",
      bodyDocument: { type: "doc", content: [] },
      bodyRenderHtml: "<p>Body</p>",
      sourceMode: "plain",
      titleRichJson: { color: "#fff" },
      displayTitleMode: "text",
      defaultReaderMode: "continuous",
      creatorRating: 8,
      contentType: "poem",
    } as DbPiece;

    expect(pieceToRevisionSnapshot(piece)).toEqual({
      titleText: "Title",
      bodyPlain: "Body",
      bodyDocument: { type: "doc", content: [] },
      bodyRenderHtml: "<p>Body</p>",
      sourceMode: "plain",
      titleRichJson: { color: "#fff" },
      displayTitleMode: "text",
      defaultReaderMode: "continuous",
      creatorRating: 8,
      contentType: "poem",
    });
  });
});
