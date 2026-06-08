/** Locked Me Via You brand palette — keep in sync with src/lib/styles/theme.css */
export const theme = {
  background: "#060b0f",
  foreground: "#e8e4f0",
  card: "#0a1016",
  primary: "#a50036",
  accent: "#5d0ec0",
  positive: "#0e7a36",
  secondary: "#0f151c",
  muted: "#0f151c",
  success: "#4ade80",
  destructive: "#e5484d",
} as const;

export type ThemeColor = keyof typeof theme;
