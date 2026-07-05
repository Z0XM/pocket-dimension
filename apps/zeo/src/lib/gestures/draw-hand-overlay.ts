import { HAND_CONNECTIONS } from "./hand-connections";
import type { DetectedGesture, HandLandmark } from "./gesture-types";

type DrawOptions = {
  mirrored?: boolean;
  holdProgress?: number;
};

export function drawHandOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  landmarks: HandLandmark[] | null,
  gesture: DetectedGesture,
  options: DrawOptions = {}
) {
  const { mirrored = false, holdProgress = 0 } = options;

  ctx.clearRect(0, 0, width, height);
  if (!landmarks?.length || width <= 0 || height <= 0) return;

  const mapX = (x: number) => (mirrored ? 1 - x : x) * width;
  const mapY = (y: number) => y * height;
  const accent = gesture === "none" ? "rgba(245, 245, 240, 0.85)" : "#8b5cf6";

  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(2, width / 120);
  ctx.lineCap = "round";

  for (const [start, end] of HAND_CONNECTIONS) {
    const a = landmarks[start];
    const b = landmarks[end];
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(mapX(a.x), mapY(a.y));
    ctx.lineTo(mapX(b.x), mapY(b.y));
    ctx.stroke();
  }

  const dotRadius = Math.max(3, width / 80);
  ctx.fillStyle = "#f5f5f0";
  for (const point of landmarks) {
    ctx.beginPath();
    ctx.arc(mapX(point.x), mapY(point.y), dotRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  if (holdProgress > 0) {
    ctx.fillStyle = "rgba(139, 92, 246, 0.45)";
    ctx.fillRect(0, height - Math.max(4, height / 40), width * holdProgress, Math.max(4, height / 40));
  }
}
