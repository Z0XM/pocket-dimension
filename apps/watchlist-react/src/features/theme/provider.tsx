import { ScriptOnce } from "@tanstack/react-router";
import { createClientOnlyFn, createIsomorphicFn } from "@tanstack/react-start";
import { createContext, type ReactNode, use, useState } from "react";
import { z } from "zod";

const AppThemeSchema = z.enum(["light", "dark"]).catch("light");

export type AppTheme = z.infer<typeof AppThemeSchema>;

const themeStorageKey = "watchlist-ui-theme";

const getStoredAppTheme = createIsomorphicFn()
  .server((): AppTheme => "dark")
  .client((): AppTheme => {
    const stored = localStorage.getItem(themeStorageKey);
    return AppThemeSchema.parse(stored);
  });

const setStoredTheme = createClientOnlyFn((theme: AppTheme) => {
  const validatedTheme = AppThemeSchema.parse(theme);
  localStorage.setItem(themeStorageKey, validatedTheme);
});

const handleThemeChange = createClientOnlyFn((appTheme: AppTheme) => {
  const validatedTheme = AppThemeSchema.parse(appTheme);

  const root = document.documentElement;
  root.classList.remove("light", "dark");

  root.classList.add(validatedTheme);
});

const themeScript = (() => {
  function themeFn() {
    const storedTheme = localStorage.getItem("watchlist-ui-theme") || "dark";
    const validTheme = ["light", "dark"].includes(storedTheme) ? storedTheme : "dark";
    document.documentElement.classList.add(validTheme);
  }
  return `(${themeFn.toString()})();`;
})();

type ThemeContextProps = {
  appTheme: AppTheme;
  setTheme: (theme: AppTheme) => void;
};
const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

type ThemeProviderProps = {
  children: ReactNode;
};
export function ThemeProvider({ children }: ThemeProviderProps) {
  const [appTheme, setAppTheme] = useState<AppTheme>(getStoredAppTheme);

  const setTheme = (newAppTheme: AppTheme) => {
    const validatedTheme = AppThemeSchema.parse(newAppTheme);
    setAppTheme(validatedTheme);
    setStoredTheme(validatedTheme);
    handleThemeChange(validatedTheme);
  };

  return (
    <ThemeContext value={{ appTheme, setTheme }}>
      <ScriptOnce>{themeScript}</ScriptOnce>
      {children}
    </ThemeContext>
  );
}

export const useTheme = () => {
  const context = use(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
