import type { ImportResult } from "$lib/importers/types";
import type { ImportProgress } from "$lib/server/import";

export type ImportStreamPhase = "parsing" | ImportProgress["phase"];

export type ImportStreamEvent =
  | { type: "phase"; phase: ImportStreamPhase; total?: number }
  | ({ type: "progress" } & ImportProgress)
  | { type: "complete"; result: ImportResult; metadata: Record<string, string> }
  | { type: "error"; message: string };

export function importProgressPercent(event: ImportStreamEvent): number {
  if (event.type === "phase") {
    if (event.phase === "parsing") return 8;
    if (event.phase === "loading") return 12;
    if (event.phase === "syncing") return 96;
    return 0;
  }

  if (event.type === "progress" && event.phase === "importing" && event.total > 0) {
    return 12 + Math.round((event.processed / event.total) * 82);
  }

  if (event.type === "complete") return 100;
  return 0;
}

export function importProgressLabel(event: ImportStreamEvent): string {
  if (event.type === "phase") {
    if (event.phase === "parsing") return "Reading statement…";
    if (event.phase === "loading") return "Checking existing transactions…";
    if (event.phase === "syncing") return "Updating balances…";
    return "Importing…";
  }

  if (event.type === "progress" && event.phase === "importing") {
    return `Importing ${event.processed.toLocaleString()} / ${event.total.toLocaleString()} rows…`;
  }

  if (event.type === "complete") return "Import complete";
  if (event.type === "error") return event.message;
  return "Importing…";
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

  if (!response.ok) {
    let message = "Import failed";
    try {
      const body = (await response.json()) as { message?: string };
      message = body.message ?? message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error("Import failed: empty response");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let complete: (ImportResult & { metadata: Record<string, string> }) | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as ImportStreamEvent;
      onEvent(event);
      if (event.type === "complete") {
        complete = { ...event.result, metadata: event.metadata };
      }
      if (event.type === "error") {
        throw new Error(event.message);
      }
    }
  }

  if (buffer.trim()) {
    const event = JSON.parse(buffer) as ImportStreamEvent;
    onEvent(event);
    if (event.type === "complete") {
      complete = { ...event.result, metadata: event.metadata };
    }
    if (event.type === "error") {
      throw new Error(event.message);
    }
  }

  if (!complete) {
    throw new Error("Import failed: no result returned");
  }

  return complete;
}
