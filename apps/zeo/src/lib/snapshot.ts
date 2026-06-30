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

  const tiles = stageRoot.querySelectorAll(".grid-stack-item, [data-tile-id]");
  const tileElements = tiles.length > 0 ? tiles : stageRoot.querySelectorAll("video");

  for (const tile of tileElements) {
    const element = tile instanceof HTMLElement ? tile : tile.parentElement;
    if (!element) continue;

    const rect = element.getBoundingClientRect();
    const x = rect.left - stageRect.left;
    const y = rect.top - stageRect.top;
    if (rect.width <= 0 || rect.height <= 0) continue;

    const video = element.querySelector("video");
    if (video instanceof HTMLVideoElement && video.readyState >= 2) {
      try {
        ctx.drawImage(video, x, y, rect.width, rect.height);
        continue;
      } catch {
        // Cross-origin or empty frame — fall through to placeholder
      }
    }

    const avatar = element.querySelector<HTMLElement>("[style*='background-color']");
    ctx.fillStyle = avatar?.style.backgroundColor || "#1c1c22";
    ctx.fillRect(x, y, rect.width, rect.height);
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
