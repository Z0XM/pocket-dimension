import type { ImportPreview, ImportResult } from "$lib/importers/types";
import type { ImportProgress } from "$lib/server/import";

export type ImportStreamPhase = "parsing" | ImportProgress["phase"];

export type ImportStreamEvent =
  | { type: "phase"; phase: ImportStreamPhase; total?: number }
  | ({ type: "progress" } & ImportProgress)
  | { type: "complete"; result: ImportResult; metadata: Record<string, string> }
  | { type: "error"; message: string };

export type ImportPreviewStreamEvent =
  | { type: "phase"; phase: ImportStreamPhase; total?: number }
  | ({ type: "progress" } & ImportProgress)
  | { type: "preview"; preview: ImportPreview }
  | { type: "error"; message: string };

export function importProgressPercent(event: ImportStreamEvent | ImportPreviewStreamEvent): number {
  if (event.type === "phase") {
    if (event.phase === "parsing") return 8;
    if (event.phase === "loading") return 12;
    if (event.phase === "syncing") return 96;
    return 0;
  }

  if (event.type === "progress" && event.phase === "importing" && event.total > 0) {
    return 12 + Math.round((event.processed / event.total) * 82);
  }

  if (event.type === "complete" || event.type === "preview") return 100;
  return 0;
}

export function importProgressLabel(event: ImportStreamEvent | ImportPreviewStreamEvent, mode: "preview" | "import" = "import"): string {
  if (event.type === "phase") {
    if (event.phase === "parsing") return "Reading statement…";
    if (event.phase === "loading") return "Checking existing transactions…";
    if (event.phase === "syncing") return mode === "preview" ? "Building preview…" : "Updating balances…";
    return mode === "preview" ? "Analyzing…" : "Importing…";
  }

  if (event.type === "progress" && event.phase === "importing") {
    const verb = mode === "preview" ? "Analyzing" : "Importing";
    return `${verb} ${event.processed.toLocaleString()} / ${event.total.toLocaleString()} rows…`;
  }

  if (event.type === "complete") return "Import complete";
  if (event.type === "preview") return "Preview ready";
  if (event.type === "error") return event.message;
  return mode === "preview" ? "Analyzing…" : "Importing…";
}

async function readFailureMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? fallback;
  } catch {
    return response.statusText || fallback;
  }
}

async function consumeNdjson<TEvent extends { type: string }>(
  response: Response,
  onEvent: (event: TEvent) => void,
  fallbackError: string
): Promise<TEvent[]> {
  if (!response.ok) {
    throw new Error(await readFailureMessage(response, fallbackError));
  }
  if (!response.body) {
    throw new Error(`${fallbackError}: empty response`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events: TEvent[] = [];

  const push = (raw: string) => {
    if (!raw.trim()) return;
    const event = JSON.parse(raw) as TEvent;
    onEvent(event);
    if (event.type === "error") {
      throw new Error(String((event as { message?: string }).message ?? fallbackError));
    }
    events.push(event);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) push(line);
  }

  if (buffer.trim()) push(buffer);
  return events;
}

export async function previewStatementWithProgress(
  accountId: string,
  formData: FormData,
  onEvent: (event: ImportPreviewStreamEvent) => void
): Promise<ImportPreview> {
  const response = await fetch(`/api/accounts/${accountId}/transactions/import/preview/stream`, {
    method: "POST",
    body: formData,
  });

  const events = await consumeNdjson<ImportPreviewStreamEvent>(response, onEvent, "Preview failed");
  const previewEvent = events.find((event): event is Extract<ImportPreviewStreamEvent, { type: "preview" }> => event.type === "preview");
  if (!previewEvent) {
    throw new Error("Preview failed: no result returned");
  }
  return previewEvent.preview;
}

export async function importStatementWithProgress(
  accountId: string,
  formData: FormData,
  onEvent: (event: ImportStreamEvent) => void
): Promise<ImportResult & { metadata: Record<string, string> }> {
  const response = await fetch(`/api/accounts/${accountId}/transactions/import/stream`, {
    method: "POST",
    body: formData,
  });

  const events = await consumeNdjson<ImportStreamEvent>(response, onEvent, "Import failed");
  const completeEvent = events.find((event): event is Extract<ImportStreamEvent, { type: "complete" }> => event.type === "complete");
  if (!completeEvent) {
    throw new Error("Import failed: no result returned");
  }
  return { ...completeEvent.result, metadata: completeEvent.metadata };
}
