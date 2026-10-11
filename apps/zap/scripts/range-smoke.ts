/**
 * Smoke-test Range response headers the way HTML5 audio does (bytes=0-).
 * Run: bun apps/zap/scripts/range-smoke.ts
 */
import { parseBytesRange } from "../src/lib/server/byte-range";

function build(size: number, range: string | null) {
  const parsed = parseBytesRange(range, size);
  if (size <= 0 || parsed.type === "full") {
    return { status: 200, headers: { "Content-Length": String(size), "Accept-Ranges": "bytes" } };
  }
  if (parsed.type === "unsatisfiable") {
    return { status: 416, headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" } };
  }
  const len = parsed.end - parsed.start + 1;
  return {
    status: 206,
    headers: {
      "Content-Length": String(len),
      "Content-Range": `bytes ${parsed.start}-${parsed.end}/${size}`,
      "Accept-Ranges": "bytes",
    },
  };
}

// OLD BUG simulation: treating Blob sync size (0) as object size
const oldBug = (() => {
  const size = 0; // Bun S3File Blob size before HEAD
  const range = "bytes=0-";
  const start = 0;
  const end = Math.max(size - 1, 0);
  const would416 = start >= size;
  return { would416, start, end, size, range };
})();

const realSize = 123456;
const audioFirst = build(realSize, "bytes=0-");
const seek = build(realSize, "bytes=64000-128000");
const noRange = build(realSize, null);

console.log(JSON.stringify({ oldBug, audioFirst, seek, noRange }, null, 2));

if (!oldBug.would416) throw new Error("expected old bug to 416");
if (audioFirst.status !== 206) throw new Error("bytes=0- should be 206 with known size");
if (audioFirst.headers["Content-Range"] !== `bytes 0-${realSize - 1}/${realSize}`) {
  throw new Error("bad Content-Range for bytes=0-");
}
if (seek.status !== 206) throw new Error("seek range should be 206");
if (noRange.status !== 200) throw new Error("no range should be 200");

console.log("range-smoke OK");
