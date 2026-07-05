import { browser } from "$app/environment";

export function registerServiceWorker() {
  if (!browser || !("serviceWorker" in navigator)) return;

  void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
    // SW is optional — install still works from manifest on most browsers.
  });
}

export function isStandaloneDisplay(): boolean {
  if (!browser) return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function prefersCoarsePointer(): boolean {
  if (!browser) return false;
  return window.matchMedia("(pointer: coarse)").matches;
}
