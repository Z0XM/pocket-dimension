import { useDashboard } from "@/context/DashboardContext";

/** Mobile header module title — from docs/project-context.md via dashboard API. */
export function ModuleBrandTitle({ className }: { className?: string }) {
  const { data } = useDashboard();
  return <span className={className}>{data?.meta.moduleName ?? "Project"}</span>;
}
