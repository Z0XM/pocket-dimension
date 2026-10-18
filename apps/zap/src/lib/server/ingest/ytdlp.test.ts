import { describe, expect, test } from "bun:test";
import { inspectCookiesText } from "./ytdlp";

describe("inspectCookiesText", () => {
  test("counts Netscape rows including #HttpOnly_ domains", () => {
    const text = [
      "# Netscape HTTP Cookie File",
      ".youtube.com\tTRUE\t/\tTRUE\t1893456000\tSID\tabc",
      "#HttpOnly_.youtube.com\tTRUE\t/\tTRUE\t1893456000\tHSID\tdef",
      ".example.com\tTRUE\t/\tFALSE\t1893456000\tx\ty",
      "",
    ].join("\r\n");
    expect(inspectCookiesText(text)).toEqual({ rows: 3, validRows: 3, youtubeRows: 2 });
  });

  test("flags JSON cookie exports as having no valid rows", () => {
    expect(inspectCookiesText('[{"domain":".youtube.com","name":"SID","value":"abc"}]')).toEqual({
      rows: 1,
      validRows: 0,
      youtubeRows: 0,
    });
  });
});
