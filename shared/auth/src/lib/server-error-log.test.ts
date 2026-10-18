import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { logServerErrors } from "./server-error-log";

function eventFor(path: string, routeId: string | null = path) {
  const url = new URL(`http://localhost${path}`);
  return { request: new Request(url.href, { method: "POST" }), url, route: { id: routeId } };
}

describe("logServerErrors", () => {
  let errorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    errorSpy = spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  test("logs 5xx JSON responses with their message", async () => {
    const response = await logServerErrors({
      event: eventFor("/api/sync"),
      resolve: () => Response.json({ message: "upstream failed" }, { status: 502 }),
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ message: "upstream failed" });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = String(errorSpy.mock.calls[0]?.[0]);
    expect(line).toContain("[502] POST /api/sync route=/api/sync");
    expect(line).toContain("— upstream failed");
  });

  test("falls back to an `error` field", async () => {
    await logServerErrors({
      event: eventFor("/api/x"),
      resolve: () => Response.json({ ok: false, error: "db down" }, { status: 500 }),
    });

    expect(String(errorSpy.mock.calls[0]?.[0])).toContain("— db down");
  });

  test("does not read non-JSON bodies", async () => {
    await logServerErrors({
      event: eventFor("/page", null),
      resolve: () => new Response("<html>oops</html>", { status: 500, headers: { "content-type": "text/html" } }),
    });

    const line = String(errorSpy.mock.calls[0]?.[0]);
    expect(line).toContain("[500] POST /page route=-");
    expect(line).not.toContain("—");
  });

  test("stays silent below 500", async () => {
    await logServerErrors({ event: eventFor("/ok"), resolve: () => new Response("ok") });
    await logServerErrors({ event: eventFor("/nope"), resolve: () => Response.json({ message: "nope" }, { status: 404 }) });

    expect(errorSpy).not.toHaveBeenCalled();
  });
});
