import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scroll to `location.hash` target after content is ready.
 * Retries briefly so late-rendered markdown headings can mount.
 */
export function useHashScroll(ready = true): void {
  const { hash, pathname, search } = useLocation();

  useEffect(() => {
    if (!ready || !hash) return;
    const id = decodeURIComponent(hash.replace(/^#/, ""));
    if (!id) return;

    let cancelled = false;
    let attempts = 0;

    const tryScroll = () => {
      if (cancelled) return;
      const el = document.getElementById(id) ?? document.querySelector(`[data-hash="${CSS.escape(id)}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      attempts += 1;
      if (attempts < 12) {
        window.setTimeout(tryScroll, 50);
      }
    };

    tryScroll();
    return () => {
      cancelled = true;
    };
  }, [hash, pathname, search, ready]);
}

export function headingSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, "-");
}
