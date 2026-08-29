import { useEffect } from "react";
import { useDashboard } from "@/context/DashboardContext";

/** Sync browser tab title to project-context `project_name`. */
export function DocumentTitle() {
  const { data } = useDashboard();
  const projectName = data?.meta.projectName;

  useEffect(() => {
    document.title = projectName?.trim() ? `Heimdall — ${projectName.trim()}` : "Heimdall";
  }, [projectName]);

  return null;
}
