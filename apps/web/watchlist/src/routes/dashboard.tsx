import { createFileRoute } from "@tanstack/react-router";
import { SignOutButton } from "@/components/auth/sign-out";
import { authClient } from "@/lib/auth-client";
import { ProtectedRoute } from "@/lib/route-protection";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: session } = authClient.useSession();

  return (
    <ProtectedRoute>
      <div className="min-h-screen p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">Dashboard</h1>
          <SignOutButton />
        </div>
        <div className="space-y-4">
          <p className="text-lg text-muted-foreground">
            Welcome to your private dashboard, {session?.user?.name || session?.user?.email}!
          </p>
          <p className="text-muted-foreground">
            This is a protected route. Only authenticated users can access it.
          </p>
          {session?.user && (
            <div className="mt-8 p-4 border rounded-lg">
              <h2 className="text-xl font-semibold mb-2">User Information</h2>
              <p className="text-sm text-muted-foreground">
                <strong>Email:</strong> {session.user.email}
              </p>
              {session.user.name && (
                <p className="text-sm text-muted-foreground">
                  <strong>Name:</strong> {session.user.name}
                </p>
              )}
              {/* {session.user.username && (
                <p className="text-sm text-muted-foreground">
                  <strong>Username:</strong> {session.user.username}
                </p>
              )} */}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
