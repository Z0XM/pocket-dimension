/** Prefer Apple modifier glyph when the platform reports Mac/iOS. */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform ?? navigator.platform ?? "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** Label for the search shortcut (⌘K vs Ctrl+K). */
export function searchShortcutLabel(): string {
  return isApplePlatform() ? "⌘K" : "Ctrl+K";
}
