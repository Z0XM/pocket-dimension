type LoggableEvent = {
  request: Request;
  url: URL;
  route: { id: string | null };
};

type LoggableHandleInput<E extends LoggableEvent> = {
  event: E;
  resolve: (event: E) => Response | Promise<Response>;
};

const MAX_MESSAGE_LENGTH = 500;

async function readErrorMessage(response: Response): Promise<string | undefined> {
  // Only buffered JSON bodies; streaming responses (NDJSON/SSE) must not be teed and awaited.
  if (!response.headers.get("content-type")?.includes("application/json")) return undefined;
  try {
    const body = (await response.clone().json()) as { message?: unknown; error?: unknown };
    const message = body?.message ?? body?.error;
    return typeof message === "string" ? message.slice(0, MAX_MESSAGE_LENGTH) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * SvelteKit `handle` that writes one stderr line for every response with status >= 500.
 *
 * SvelteKit only calls `handleError` for unexpected exceptions; `error(5xx, ...)` and
 * hand-built `json(..., { status: 500 })` responses are otherwise never logged.
 * Compose first: `sequence(logServerErrors, appHandle)`.
 */
export async function logServerErrors<E extends LoggableEvent>({ event, resolve }: LoggableHandleInput<E>) {
  const startedAt = performance.now();
  const response = await resolve(event);

  if (response.status >= 500) {
    const durationMs = Math.round(performance.now() - startedAt);
    const message = await readErrorMessage(response);
    console.error(
      `[${response.status}] ${event.request.method} ${event.url.pathname}` +
        ` route=${event.route.id ?? "-"} ${durationMs}ms` +
        (message ? ` — ${message}` : "")
    );
  }

  return response;
}
