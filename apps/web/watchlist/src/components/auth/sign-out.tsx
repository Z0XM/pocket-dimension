import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      navigate({ to: "/" });
    } catch (err) {
      console.error("Failed to sign out:", err);
    }
  };

  return (
    <Button variant="outline" onClick={handleSignOut}>
      Sign Out
    </Button>
  );
}
