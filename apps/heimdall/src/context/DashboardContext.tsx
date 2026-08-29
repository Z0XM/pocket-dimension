import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchDashboard, fetchRuntime, subscribeToReload, type DashboardSnapshot } from "../api/client";
import { dashboardModuleQueryArg, resolveClientModuleScope, shouldShowModuleScopeControl, type RuntimeModule } from "@/lib/moduleScope";
import { applyDocumentTheme, readStoredTheme, resolveTheme } from "@/lib/theme";

const DashboardContext = createContext<{
  data: DashboardSnapshot | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  modules: RuntimeModule[];
  moduleScope: string;
  setModuleScope: (scope: string) => void;
  showModuleScope: boolean;
}>({
  data: null,
  loading: true,
  error: null,
  reload: () => {},
  modules: [],
  moduleScope: "all",
  setModuleScope: () => {},
  showModuleScope: false,
});

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [modules, setModules] = useState<RuntimeModule[]>([]);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const moduleScope = useMemo(() => resolveClientModuleScope(searchParams.get("module"), modules), [searchParams, modules]);

  const showModuleScope = shouldShowModuleScopeControl(modules);

  useEffect(() => {
    let cancelled = false;
    fetchRuntime()
      .then((runtime) => {
        if (cancelled) return;
        setModules(runtime.modules);
        // Hydrate inject so pagesTestLevels() / pagesTestsEnabled() match server config
        // (standalone CLI build may omit VITE_HEIMDALL_TEST_LEVELS).
        if (typeof window !== "undefined") {
          const prev = window.__HEIMDALL_RUNTIME__;
          const configDefault = runtime.branding?.defaultTheme;
          window.__HEIMDALL_RUNTIME__ = {
            basePath: runtime.basePath || prev?.basePath || "/",
            apiDocsPath: prev?.apiDocsPath ?? null,
            samplePath: prev?.samplePath ?? null,
            dashboardApiBase: prev?.dashboardApiBase ?? "/api",
            uiStoragePrefix: runtime.uiStoragePrefix ?? prev?.uiStoragePrefix,
            defaultTheme: configDefault ?? prev?.defaultTheme,
            pages: {
              tests: runtime.pages?.tests ?? prev?.pages?.tests,
              testLevels: runtime.pages?.testLevels ?? prev?.pages?.testLevels,
            },
          };
          applyDocumentTheme(
            resolveTheme({
              stored: readStoredTheme(),
              defaultTheme: configDefault ?? prev?.defaultTheme,
            })
          );
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setRuntimeReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!runtimeReady || !showModuleScope) return;
    const raw = searchParams.get("module");
    if (raw == null || raw === "") {
      const params = new URLSearchParams(searchParams);
      params.set("module", resolveClientModuleScope(null, modules));
      setSearchParams(params, { replace: true });
    }
  }, [runtimeReady, showModuleScope, modules, searchParams, setSearchParams]);

  const reload = useCallback(() => {
    if (!runtimeReady) return;
    setError(null);
    setLoading(true);
    const arg = dashboardModuleQueryArg(moduleScope, modules);
    fetchDashboard(arg)
      .then((snapshot) => {
        setData(snapshot);
        setError(null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setLoading(false));
  }, [runtimeReady, moduleScope, modules]);

  useEffect(() => {
    reload();
    return subscribeToReload(reload);
  }, [reload]);

  const setModuleScope = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams);
      params.set("module", next);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  return (
    <DashboardContext.Provider
      value={{
        data,
        loading,
        error,
        reload,
        modules,
        moduleScope,
        setModuleScope,
        showModuleScope,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  return useContext(DashboardContext);
}
