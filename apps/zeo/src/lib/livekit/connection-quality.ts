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

export function qualityDisplayLabel(label: QualityLabel) {
  switch (label) {
    case "excellent":
      return "Excellent";
    case "good":
      return "Good";
    case "poor":
      return "Poor";
    default:
      return "Unknown";
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

export function qualityClass(label: QualityLabel) {
  switch (label) {
    case "excellent":
      return "bg-emerald-500/90";
    case "good":
      return "bg-amber-500/90";
    case "poor":
      return "bg-red-500/90";
    default:
      return "bg-muted-foreground/70";
  }
}
