export type IngestEvent = Record<string, unknown>;

export async function readNdjsonStream(res: Response, onEvent: (ev: IngestEvent) => void): Promise<void> {
  if (!res.body) throw new Error("Response stream missing");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line) as IngestEvent);
    }
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer) as IngestEvent);
}

/** XHR (not fetch) so the browser reports upload progress while the server streams NDJSON back. */
export function xhrFormNdjson(
  url: string,
  formData: FormData,
  onUploadPercent: (percent: number) => void,
  onEvent: (ev: IngestEvent) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    let seen = 0;
    let lineBuf = "";
    const consume = (chunk: string) => {
      lineBuf += chunk;
      const lines = lineBuf.split("\n");
      lineBuf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        onEvent(JSON.parse(line) as IngestEvent);
      }
    };
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable || e.total <= 0) return;
      onUploadPercent(Math.max(0, Math.min(100, Math.round((e.loaded / e.total) * 100))));
    };
    xhr.onprogress = () => {
      const text = xhr.responseText.slice(seen);
      seen = xhr.responseText.length;
      try {
        consume(text);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Bad progress event"));
      }
    };
    xhr.onload = () => {
      try {
        consume(xhr.responseText.slice(seen));
        if (lineBuf.trim()) onEvent(JSON.parse(lineBuf) as IngestEvent);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Bad upload response"));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(formData);
  });
}

export type ImportCounts = { imported: number; unavailable: number; skipped: number; failed: number };

export function readImportCounts(ev: IngestEvent): ImportCounts {
  return {
    imported: Number(ev.imported ?? 0),
    unavailable: Number(ev.unavailable ?? 0),
    skipped: Number(ev.skipped ?? 0),
    failed: Number(ev.failed ?? 0),
  };
}

export function describeImportCounts(prefix: string, c: ImportCounts): string {
  const parts = [`${c.imported} imported`];
  if (c.unavailable) parts.push(`${c.unavailable} saved as not available`);
  if (c.skipped) parts.push(`${c.skipped} skipped`);
  if (c.failed) parts.push(`${c.failed} failed`);
  return `${prefix} — ${parts.join(" · ")}.`;
}
