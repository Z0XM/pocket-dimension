import { describe, expect, test } from "bun:test";
import { describeImportCounts, readImportCounts, readNdjsonStream } from "./ingest-client";

describe("readNdjsonStream", () => {
  test("parses events split across chunks, including a trailing unterminated line", async () => {
    const chunks = ['{"type":"song","percent":1', '0}\n\n{"type":"progress"}\n{"type":"done","imported":2}'];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(new TextEncoder().encode(c));
        controller.close();
      },
    });
    const events: Record<string, unknown>[] = [];
    await readNdjsonStream(new Response(body), (ev) => events.push(ev));
    expect(events).toEqual([{ type: "song", percent: 10 }, { type: "progress" }, { type: "done", imported: 2 }]);
  });
});

describe("import counts", () => {
  test("defaults missing counts to zero", () => {
    expect(readImportCounts({ imported: 3, failed: "1" })).toEqual({ imported: 3, unavailable: 0, skipped: 0, failed: 1 });
  });

  test("only lists non-zero extras", () => {
    expect(describeImportCounts("Done", { imported: 1, unavailable: 0, skipped: 0, failed: 0 })).toBe("Done — 1 imported.");
    expect(describeImportCounts("Done", { imported: 0, unavailable: 2, skipped: 1, failed: 3 })).toBe(
      "Done — 0 imported · 2 saved as not available · 1 skipped · 3 failed."
    );
  });
});
