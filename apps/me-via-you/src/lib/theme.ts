/** Locked Me Via You brand palette — keep in sync with src/lib/styles/theme.css */

export const themeLight = {
  background: "#f9f4ea",
  foreground: "#241c14",
  card: "#fffdf7",
  primary: "#a50036",
  accent: "#5d0ec0",
  positive: "#0e7a36",
  secondary: "#f1e8d8",
  muted: "#efe6d6",
  success: "#16a34a",
  destructive: "#d93a3f",
} as const;

export const themeDark = {
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

/** Default programmatic reference (dark). */
export const theme = themeDark;

export type ThemeColor = keyof typeof themeDark;
