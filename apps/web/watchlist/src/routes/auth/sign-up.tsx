import { createFileRoute } from "@tanstack/react-router";
import { SignUpForm } from "@/components/auth/sign-up";
import { PublicAuthRoute } from "@/lib/route-protection";

export const Route = createFileRoute("/auth/sign-up")({
  component: SignUpPage,
});

function SignUpPage() {
  return (
    <PublicAuthRoute>
      <SignUpForm redirect="/" />
    </PublicAuthRoute>
  );
}
