import { Link, NavLink, useLocation } from "react-router-dom";
import {
  BookOpen,
  Braces,
  CircleHelp,
  Clock3,
  Database,
  ExternalLink,
  Layers,
  LayoutDashboard,
  PanelLeft,
  PanelLeftClose,
  Puzzle,
  ShieldAlert,
  TestTube2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useDashboard } from "@/context/DashboardContext";
import { apiDocsPath, pagesTestsEnabled, samplePath } from "@/lib/runtime-config";
import { cn } from "@/lib/utils";

const BASE_NAV_ITEMS = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/features", label: "Features", icon: Puzzle },
  { to: "/delivery", label: "Epics & Stories", icon: Layers },
  { to: "/blockers", label: "Blockers", icon: ShieldAlert },
  { to: "/questions", label: "Questions", icon: CircleHelp },
  { to: "/deferred", label: "Deferred", icon: Clock3 },
  { to: "/browse", label: "Docs", icon: BookOpen },
] as const;

/** Resolve nav items at call time so `pages.tests` from runtime/env is honored. */
export function getNavItems() {
  if (!pagesTestsEnabled()) return [...BASE_NAV_ITEMS];
  return [...BASE_NAV_ITEMS, { to: "/tests", label: "Tests", icon: TestTube2 }];
}

/** @deprecated prefer getNavItems() — kept for older imports; evaluates at module load. */
export const NAV_ITEMS = getNavItems();

export function SidebarNav({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  const location = useLocation();
  const apiHref = apiDocsPath();
  const sampleHref = samplePath();
  const navItems = getNavItems();

  return (
    <>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={{ pathname: item.to, search: location.search }}
            end={"end" in item ? item.end : undefined}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                "flex cursor-pointer items-center rounded-lg py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                collapsed ? "justify-center px-2" : "gap-2.5 px-3",
                isActive && "bg-accent/80 font-medium text-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-heading" : "opacity-70")} />
                {!collapsed && item.label}
              </>
            )}
          </NavLink>
        ))}
        {(apiHref || sampleHref) && <Separator className="my-2" />}
        {apiHref && (
          <a
            href={apiHref}
            target="_blank"
            rel="noreferrer"
            title={collapsed ? "API (external)" : undefined}
            className={cn(
              "flex cursor-pointer items-center rounded-lg py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              collapsed ? "justify-center px-2" : "gap-2.5 px-3"
            )}
          >
            <Braces className="h-4 w-4 shrink-0 opacity-70" />
            {!collapsed && (
              <>
                API
                <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
              </>
            )}
          </a>
        )}
        {sampleHref && (
          <a
            href={sampleHref}
            target="_blank"
            rel="noreferrer"
            title={collapsed ? "Sample (external)" : undefined}
            className={cn(
              "flex cursor-pointer items-center rounded-lg py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              collapsed ? "justify-center px-2" : "gap-2.5 px-3"
            )}
          >
            <Database className="h-4 w-4 shrink-0 opacity-70" />
            {!collapsed && (
              <>
                Sample
                <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
              </>
            )}
          </a>
        )}
      </nav>
      {!collapsed && <div className="p-3 text-[0.7rem] text-muted-foreground/70">BMAD sprint tracking</div>}
    </>
  );
}

export function SidebarBrand({ collapsed = false, onToggle }: { collapsed?: boolean; onToggle?: () => void }) {
  const location = useLocation();
  const { data } = useDashboard();
  const moduleName = data?.meta.moduleName ?? "Project";

  const toggleButton = onToggle ? (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0 text-muted-foreground"
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      onClick={onToggle}
    >
      {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
    </Button>
  ) : null;

  if (collapsed) {
    return <div className="flex justify-center px-2 py-4">{toggleButton}</div>;
  }

  return (
    <div className="flex items-start justify-between gap-2 px-4 py-5">
      <Link
        to={{ pathname: "/", search: location.search }}
        className="min-w-0 cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="font-display text-base leading-snug text-foreground hover:text-heading">{moduleName}</div>
        <div className="mt-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Heimdall</div>
      </Link>
      {toggleButton}
    </div>
  );
}
