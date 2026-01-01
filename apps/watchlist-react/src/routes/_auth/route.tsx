import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AnimatedZ } from "@/components/animated-z";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/features/theme/toggle";

export const Route = createFileRoute("/_auth")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center p-6 md:p-10">
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="w-full max-w-sm md:max-w-4xl">
        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden p-0">
            <CardContent className="grid p-0 md:grid-cols-2">
              <Outlet />
              <div className="bg-muted relative hidden md:block">
                <AnimatedZ className="absolute inset-0 h-full w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
