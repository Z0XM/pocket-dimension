import { describe, expect, test } from "bun:test";
import { coalesceMeta } from "./pipeline";

describe("coalesceMeta", () => {
  test("prefers yt-dlp probe over playlist hints", () => {
    const out = coalesceMeta(
      {
        description: "from probe",
        channelTitle: "Probe Channel",
        channelId: "UCprobe",
        uploader: "Uploader",
      },
      {
        description: "from hint",
        channelTitle: "Hint Channel",
        channelId: "UChint",
      }
    );
    expect(out.description).toBe("from probe");
    expect(out.channelTitle).toBe("Probe Channel");
    expect(out.channelId).toBe("UCprobe");
    expect(out.artists).toBe("Uploader");
  });

  test("falls back to playlist hints when probe empty", () => {
    const out = coalesceMeta(
      {
        description: null,
        channelTitle: null,
        channelId: null,
        uploader: null,
      },
      {
        description: "hint desc",
        channelTitle: "Hint Channel",
        channelId: "UChint",
      }
    );
    expect(out.description).toBe("hint desc");
    expect(out.channelTitle).toBe("Hint Channel");
    expect(out.channelId).toBe("UChint");
    expect(out.artists).toBe("Hint Channel");
  });
});
