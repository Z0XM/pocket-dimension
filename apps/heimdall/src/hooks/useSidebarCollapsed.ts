import { useCallback, useState } from "react";
import { uiStorageKey } from "@/lib/runtime-config";

const LEGACY_SIDEBAR_KEY = "si-dev-dashboard-sidebar-collapsed";

function sidebarStorageKey(): string {
  return uiStorageKey("sidebar-collapsed");
}

function readCollapsed(): boolean {
  try {
    const key = sidebarStorageKey();
    const current = localStorage.getItem(key);
    if (current != null) return current === "true";
    const legacy = localStorage.getItem(LEGACY_SIDEBAR_KEY);
    if (legacy != null) {
      // Copy forward; keep legacy key so co-resident SI UIs on the same origin still work.
      localStorage.setItem(key, legacy);
      return legacy === "true";
    }
    return false;
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(sidebarStorageKey(), String(collapsed));
  } catch {
    // ignore quota / private mode
  }
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsed(next);
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
