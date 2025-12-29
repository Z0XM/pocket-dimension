import { Navigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { data: session, isPending } = authClient.useSession();
  const location = useRouterState({
    select: (state) => state.location,
  });

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!session) {
    const redirectUrl = `/auth/sign-in?redirect=${encodeURIComponent(location.pathname)}`;
    return <Navigate to={redirectUrl} />;
  }

  return <>{children}</>;
}

interface PublicAuthRouteProps {
  children: ReactNode;
}

export function PublicAuthRoute({ children }: PublicAuthRouteProps) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (session) {
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
}
