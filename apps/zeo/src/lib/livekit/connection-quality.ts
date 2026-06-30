import { ConnectionQuality } from "livekit-client";

export type QualityLabel = "excellent" | "good" | "poor" | "unknown";

export function qualityLabel(quality: ConnectionQuality): QualityLabel {
  switch (quality) {
    case ConnectionQuality.Excellent:
      return "excellent";
    case ConnectionQuality.Good:
      return "good";
    case ConnectionQuality.Poor:
      return "poor";
    default:
      return "unknown";
  }
}

export function qualityTitle(label: QualityLabel, pingMs?: number | null) {
  const base = (() => {
    switch (label) {
      case "excellent":
        return "Excellent connection";
      case "good":
        return "Good connection";
      case "poor":
        return "Poor connection";
      default:
        return "Connection quality unknown";
    }
  })();

  if (pingMs != null && pingMs > 0) {
    return `${base} · ${pingMs} ms ping`;
  }

  return base;
}

export function qualityBarCount(label: QualityLabel) {
  switch (label) {
    case "excellent":
      return 4;
    case "good":
      return 3;
    case "poor":
      return 2;
    default:
      return 1;
  }
}

export function qualitySignalClass(label: QualityLabel) {
  switch (label) {
    case "excellent":
      return "bg-emerald-500";
    case "good":
      return "bg-amber-500";
    case "poor":
      return "bg-red-500";
    default:
      return "bg-muted-foreground";
  }
}

export function qualityTextClass(label: QualityLabel) {
  switch (label) {
    case "excellent":
      return "text-emerald-500";
    case "good":
      return "text-amber-500";
    case "poor":
      return "text-red-500";
    default:
      return "text-muted-foreground";
  }
}
