import { describe, expect, test } from "bun:test";
import { parseYtDlpDownloadPercent } from "./progress";

describe("parseYtDlpDownloadPercent", () => {
  test("parses percent lines", () => {
    expect(parseYtDlpDownloadPercent("[download]  12.3% of 3.45MiB at  1.23MiB/s ETA 00:02")).toBe(12);
    expect(parseYtDlpDownloadPercent("[download] 100% of 3.45MiB in 00:03")).toBe(100);
  });

  test("ignores unrelated lines", () => {
    expect(parseYtDlpDownloadPercent("[info] Downloading")).toBeNull();
  });
});
