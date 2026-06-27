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

export function qualityTitle(label: QualityLabel) {
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
