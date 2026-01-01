import { DesktopIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type UserTheme, useTheme } from "./provider";

const themeConfig: Record<UserTheme, { icon: React.ReactNode; label: string }> = {
  light: { icon: <SunIcon size={36} weight="duotone" />, label: "Light" },
  dark: { icon: <MoonIcon size={36} weight="duotone" />, label: "Dark" },
  system: { icon: <DesktopIcon size={36} weight="duotone" />, label: "System" },
};

export const ThemeToggle = ({ className }: { className?: string }) => {
  const { userTheme, setTheme } = useTheme();

  const getNextTheme = () => {
    const themes = Object.keys(themeConfig) as UserTheme[];
    const currentIndex = themes.indexOf(userTheme);
    const nextIndex = (currentIndex + 1) % themes.length;
    return themes[nextIndex];
  };

  const nextTheme = getNextTheme();

  return (
    <Button
      variant="outline"
      onClick={() => setTheme(nextTheme)}
      className={cn("cursor-pointer rounded-full w-10 h-10", className)}
      title={`Switch to ${themeConfig[nextTheme].label}`}
    >
      <span className="not-system:light:inline hidden [&_svg]:size-[20px]!">
        {themeConfig.light.icon}
      </span>
      <span className="not-system:dark:inline hidden [&_svg]:size-[20px]!">
        {themeConfig.dark.icon}
      </span>
      <span className="system:inline hidden [&_svg]:size-[20px]!">{themeConfig.system.icon}</span>
    </Button>
  );
};
