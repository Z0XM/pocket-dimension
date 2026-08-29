import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Menu, Search } from "lucide-react";
import { DocumentTitle } from "@/components/DocumentTitle";
import { MobileNav } from "@/components/MobileNav";
import { ModuleBrandTitle } from "@/components/ModuleBrandTitle";
import { ModuleScopeControl } from "@/components/ModuleScopeControl";
import { SearchPalette, useSearchShortcut } from "@/components/SearchPalette";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SidebarBrand, SidebarNav } from "@/components/SidebarNav";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DashboardProvider } from "@/context/DashboardContext";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { searchShortcutLabel } from "@/lib/platform";
import { pagesTestsEnabled } from "@/lib/runtime-config";
import { cn } from "@/lib/utils";
import { BlockersPage } from "@/pages/BlockersPage";
import { DeferredPage } from "@/pages/DeferredPage";
import { DeliveryPage } from "@/pages/DeliveryPage";
import { DocsPage } from "@/pages/DocsPage";
import { EpicDetailPage } from "@/pages/EpicDetailPage";
import { FeaturesPage } from "@/pages/FeaturesPage";
import { OverviewPage } from "@/pages/OverviewPage";
import { QuestionsPage } from "@/pages/QuestionsPage";
import { StoryDetailPage } from "@/pages/StoryDetailPage";
import { TestsPage } from "@/pages/TestsPage";

export default function App() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const { collapsed: sidebarCollapsed, toggle: toggleSidebar } = useSidebarCollapsed();
  const location = useLocation();
  const testsEnabled = pagesTestsEnabled();
  useSearchShortcut(() => setSearchOpen(true));

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  return (
    <DashboardProvider>
      <DocumentTitle />
      <div className="app-grain" aria-hidden />
      <div className="flex h-[100dvh] overflow-hidden">
        <aside
          className={cn(
            "sticky top-0 hidden h-[100dvh] shrink-0 flex-col overflow-y-auto border-r border-border/60 bg-card/30 backdrop-blur-md transition-[width] duration-200 lg:flex",
            sidebarCollapsed ? "w-14" : "w-56"
          )}
        >
          <SidebarBrand collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
          <Separator />
          <SidebarNav collapsed={sidebarCollapsed} />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-card/20 px-3 py-2.5 backdrop-blur-sm sm:gap-3 sm:px-5 sm:py-3">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 lg:hidden"
                aria-label="Open navigation menu"
                onClick={() => setNavOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <span className="truncate text-xs text-muted-foreground sm:text-sm">
                <ModuleBrandTitle className="font-display text-sm text-foreground lg:hidden" />
                <span className="hidden lg:inline">
                  Planning artifacts · live from <code className="font-mono text-xs">docs/</code>
                </span>
              </span>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <ModuleScopeControl />
              <ThemeToggle />
              <Button variant="outline" size="sm" className="shrink-0 gap-2 text-muted-foreground" onClick={() => setSearchOpen(true)}>
                <Search className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Search</span>
                <kbd className="pointer-events-none ml-1 hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.65rem] md:inline">
                  {searchShortcutLabel()}
                </kbd>
              </Button>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-6">
            <Routes>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/delivery" element={<DeliveryPage />} />
              <Route path="/epics" element={<Navigate to="/delivery" replace />} />
              <Route path="/epics/:epicId" element={<EpicDetailPage />} />
              <Route path="/stories" element={<Navigate to="/delivery" replace />} />
              <Route path="/stories/:storyId" element={<StoryDetailPage />} />
              <Route path="/timeline" element={<Navigate to="/delivery?view=timeline" replace />} />
              <Route path="/roadmap" element={<Navigate to="/delivery?view=timeline" replace />} />
              <Route path="/blockers" element={<BlockersPage />} />
              <Route path="/questions" element={<QuestionsPage />} />
              <Route path="/deferred" element={<DeferredPage />} />
              <Route path="/browse" element={<DocsPage />} />
              {testsEnabled && <Route path="/tests" element={<TestsPage />} />}
            </Routes>
          </main>
        </div>
      </div>

      <MobileNav open={navOpen} onOpenChange={setNavOpen} />
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </DashboardProvider>
  );
}
