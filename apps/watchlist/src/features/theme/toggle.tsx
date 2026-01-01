import { DesktopIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { type UserTheme, useTheme } from "./provider";

const themeConfig: Record<UserTheme, { icon: React.ReactNode; label: string }> = {
  light: { icon: <SunIcon size={16} />, label: "Light" },
  dark: { icon: <MoonIcon size={16} />, label: "Dark" },
  system: { icon: <DesktopIcon size={16} />, label: "System" },
};

export const ThemeToggle = () => {
  const { userTheme, setTheme } = useTheme();

  const getNextTheme = () => {
    const themes = Object.keys(themeConfig) as UserTheme[];
    const currentIndex = themes.indexOf(userTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    return themes[nextIndex];
  };

  return (
    <Button onClick={() => setTheme(getNextTheme())} className="w-28">
      <span className="not-system:light:inline hidden">
        {themeConfig.light.label}
        <span className="ml-1">{themeConfig.light.icon}</span>
      </span>
      <span className="not-system:dark:inline hidden">
        {themeConfig.dark.label}
        <span className="ml-1">{themeConfig.dark.icon}</span>
      </span>
      <span className="system:inline hidden">
        {themeConfig.system.label}
        <span className="ml-1">{themeConfig.system.icon}</span>
      </span>
    </Button>
  );
};
