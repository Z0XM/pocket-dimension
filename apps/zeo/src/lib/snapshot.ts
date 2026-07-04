/**
 * Client-side PNG capture of the visible call stage (grid or screen-share layout).
 */
export async function captureCallSnapshot(options: { slug: string; stageRoot: HTMLElement }) {
  const { slug, stageRoot } = options;
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

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("Snapshot failed"));
    }, "image/png");
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `zeo-${slug}-${timestamp}.png`;
  anchor.click();
  URL.revokeObjectURL(url);
}
