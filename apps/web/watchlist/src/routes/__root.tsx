import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider } from "@/providers/auth-provider";

export const Route = createRootRoute({
  component: () => (
    <AuthProvider>
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <Outlet />
      <TanStackRouterDevtools />
    </AuthProvider>
  ),
});
