import { describe, expect, test } from "bun:test";
import { parseCsv, rowsToCsv } from "./csv";

describe("connectors csv", () => {
  test("round-trips simple rows", () => {
    const columns = ["title", "type", "language"];
    const rows = [
      { title: "Inception", type: "movie", language: "English" },
      { title: "Spirited Away", type: "movie", language: "Japanese" },
    ];
    const csv = rowsToCsv(columns, rows);
    const parsed = parseCsv(csv);
    expect(parsed.headers).toEqual(columns);
    expect(parsed.rows).toEqual([
      { title: "Inception", type: "movie", language: "English" },
      { title: "Spirited Away", type: "movie", language: "Japanese" },
    ]);
  });

  test("escapes commas and quotes", () => {
    const csv = rowsToCsv(["title", "review"], [{ title: 'Say "Hello", world', review: "a,b" }]);
    const parsed = parseCsv(csv);
    expect(parsed.rows[0].title).toBe('Say "Hello", world');
    expect(parsed.rows[0].review).toBe("a,b");
  });
});
