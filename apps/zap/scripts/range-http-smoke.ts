/**
 * HTTP-level smoke: serve an in-memory "object" with the same Range rules as /api/media/.../audio
 * Run: bun ./scripts/range-http-smoke.ts
 */
import { parseBytesRange } from "../src/lib/server/byte-range";

const SIZE = 50_000;
const object = new Uint8Array(SIZE);
for (let i = 0; i < SIZE; i++) object[i] = i % 256;

const server = Bun.serve({
  port: 0,
  fetch(req) {
    const range = req.headers.get("range");
    const size = object.byteLength;
    const parsed = parseBytesRange(range, size);

    if (size <= 0 || parsed.type === "full") {
      return new Response(object, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": String(size),
          "Accept-Ranges": "bytes",
        },
      });
    }
    if (parsed.type === "unsatisfiable") {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" },
      });
    }
    const { start, end } = parsed;
    const slice = object.slice(start, end + 1);
    return new Response(slice, {
      status: 206,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(slice.byteLength),
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
      },
    });
  },
});

const base = `http://127.0.0.1:${server.port}`;

async function check(label: string, headers: Record<string, string>, expectStatus: number) {
  const res = await fetch(base + "/audio", { headers });
  const len = res.headers.get("content-length");
  const cr = res.headers.get("content-range");
  const ar = res.headers.get("accept-ranges");
  console.log(label, { status: res.status, len, cr, ar });
  if (res.status !== expectStatus) throw new Error(`${label}: expected ${expectStatus} got ${res.status}`);
  if (ar !== "bytes") throw new Error(`${label}: missing Accept-Ranges`);
  await res.arrayBuffer();
}

await check("no-range", {}, 200);
await check("audio-first", { Range: "bytes=0-" }, 206);
await check("seek", { Range: "bytes=1000-1999" }, 206);
await check("past-eof", { Range: "bytes=999999-" }, 416);

server.stop(true);
console.log("range-http-smoke OK");
