import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type AppTheme, useTheme } from "./provider";

const themeConfig: Record<AppTheme, { icon: React.ReactNode; label: string }> = {
  light: {
    icon: (
      <SunIcon
        size={36}
        className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all! dark:scale-0 dark:-rotate-90"
        weight="duotone"
      />
    ),
    label: "Light",
  },
  dark: {
    icon: (
      <MoonIcon
        size={36}
        className="h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all! dark:scale-100 dark:rotate-0"
        weight="duotone"
      />
    ),
    label: "Dark",
  },
};

export const ThemeToggle = ({ className }: { className?: string }) => {
  const { appTheme, setTheme } = useTheme();

  const getNextTheme = () => {
    const themes = Object.keys(themeConfig) as AppTheme[];
    const currentIndex = themes.indexOf(appTheme);
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
      {/* <span className="not-system:light:inline hidden [&_svg]:size-[20px]!">
        {themeConfig.light.icon}
      </span>
      <span className="not-system:dark:inline hidden [&_svg]:size-[20px]!">
        {themeConfig.dark.icon}
      </span>
      <span className="system:inline hidden [&_svg]:size-[20px]!">{themeConfig.system.icon}</span> */}
      <span className="not-system:light:inline hidden ">{themeConfig.light.icon}</span>
      <span className="not-system:dark:inline hidden ">{themeConfig.dark.icon}</span>
    </Button>
  );
};
