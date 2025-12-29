import { createFileRoute } from "@tanstack/react-router";
import { SignInForm } from "@/components/auth/sign-in";
import { PublicAuthRoute } from "@/lib/route-protection";

export const Route = createFileRoute("/auth/sign-in")({
  component: SignInPage,
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: (search.redirect as string) || undefined,
  }),
});

function SignInPage() {
  const { redirect } = Route.useSearch();
  return (
    <PublicAuthRoute>
      <SignInForm redirect="/" />
    </PublicAuthRoute>
  );
}
