<script lang="ts">
// import { toast } from "svelte-sonner";
import { goto } from "$app/navigation";
import { Button } from "$components/ui/button/index.js";
import { authClient } from "$lib/auth-client.js";

let loading = $state(false);

async function handleLogout() {
  loading = true;
  try {
    await authClient.signOut();
    await goto("/sign-in");
  } catch (err) {
    console.error("Logout error:", err);
    loading = false;
  }
}
</script>

<Button variant="outline" onclick={handleLogout} disabled={loading}>
  {loading ? "Logging out..." : "Logout"}
</Button>
