import { useCallback, useState } from "react";
import { defaultTheme } from "@/lib/runtime-config";
import { readStoredTheme, resolveTheme, setDocumentTheme, type HeimdallTheme } from "@/lib/theme";

function readInitialTheme(): HeimdallTheme {
  return resolveTheme({
    stored: readStoredTheme(),
    defaultTheme: defaultTheme(),
  });
}

export function useTheme() {
  const [theme, setThemeState] = useState<HeimdallTheme>(readInitialTheme);

  const setTheme = useCallback((next: HeimdallTheme) => {
    setDocumentTheme(next);
    setThemeState(next);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((current) => {
      const next = current === "dark" ? "light" : "dark";
      setDocumentTheme(next);
      return next;
    });
  }, []);

  return { theme, setTheme, toggle };
}
