/**
 * Client-side PNG capture of the visible call stage (grid or screen-share layout).
 */
export async function captureStageToBlob(stageRoot: HTMLElement) {
  const stageRect = stageRoot.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(stageRect.width * scale));
  canvas.height = Math.max(1, Math.floor(stageRect.height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create snapshot canvas");

  ctx.scale(scale, scale);
  ctx.fillStyle = "#0a0a0c";
  ctx.fillRect(0, 0, stageRect.width, stageRect.height);

  const videos = stageRoot.querySelectorAll("video");
  for (const video of videos) {
    if (!(video instanceof HTMLVideoElement) || video.readyState < 2) continue;

    const rect = video.getBoundingClientRect();
    const x = rect.left - stageRect.left;
    const y = rect.top - stageRect.top;
    if (rect.width <= 0 || rect.height <= 0) continue;

    try {
      ctx.drawImage(video, x, y, rect.width, rect.height);
    } catch {
      // Cross-origin or empty frame — skip tile
    }
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("Snapshot failed"));
    }, "image/png");
  });
}

export async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read snapshot"));
    };
    reader.onerror = () => reject(new Error("Could not read snapshot"));
    reader.readAsDataURL(blob);
  });
}

/** Stay under svelte-adapter-bun's default 512KB request body limit (JSON + base64). */
const CHAT_SNAPSHOT_MAX_PAYLOAD = 450_000;

async function resizeSnapshotToDataUrl(blob: Blob, maxWidth: number, mime: "image/png" | "image/jpeg", quality?: number) {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Could not compress snapshot");
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const resized = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("Snapshot compression failed"))), mime, quality);
  });

  return blobToDataUrl(resized);
}

/** Downscale/compress a capture so it can be posted to chat without hitting body-size limits. */
export async function compressSnapshotForChat(blob: Blob) {
  let maxWidth = 1280;

  while (maxWidth >= 480) {
    const dataUrl = await resizeSnapshotToDataUrl(blob, maxWidth, "image/jpeg", 0.85);
    if (dataUrl.length <= CHAT_SNAPSHOT_MAX_PAYLOAD) {
      return dataUrl;
    }
    maxWidth = Math.floor(maxWidth * 0.75);
  }

  throw new Error("Snapshot is too large to share in chat");
}

export function downloadSnapshotBlob(blob: Blob, slug: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `zeo-${slug}-${timestamp}.png`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Capture stage, download locally, and return PNG blob for sharing. */
export async function captureCallSnapshot(options: { slug: string; stageRoot: HTMLElement }) {
  const blob = await captureStageToBlob(options.stageRoot);
  downloadSnapshotBlob(blob, options.slug);
  return blob;
}
