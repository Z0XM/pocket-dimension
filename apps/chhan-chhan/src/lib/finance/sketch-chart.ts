/** Deterministic 0..1 noise for sketchy chart paths. */
export function sketchNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export type ChartPoint = { x: number; y: number };

/** Build a slightly wobbly SVG path through chart points (hand-drawn feel). */
export function sketchLinePath(points: ChartPoint[], wobble = 2.2, seed = 1): string {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  const parts: string[] = [`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`];

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const steps = Math.max(2, Math.min(5, Math.round(len / 55)));

    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      const jitter = (sketchNoise(seed * 17 + i * 31 + step * 13) - 0.5) * wobble * (step === steps ? 0.35 : 1);
      const x = a.x + dx * t + nx * jitter;
      const y = a.y + dy * t + ny * jitter;
      parts.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
  }

  return parts.join(" ");
}

/** Close a sketch path down to the baseline for a soft area fill. */
export function sketchAreaPath(points: ChartPoint[], baseY: number, wobble = 2.2, seed = 1): string {
  if (!points.length) return "";
  const line = sketchLinePath(points, wobble, seed);
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L ${last.x.toFixed(1)} ${baseY.toFixed(1)} L ${first.x.toFixed(1)} ${baseY.toFixed(1)} Z`;
}
