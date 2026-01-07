<script lang="ts">
import { LoaderCircleIcon, LogInIcon, UserRoundIcon } from "@lucide/svelte";
import { goto } from "$app/navigation";
import { page } from "$app/state";
import LogoutButton from "$components/logout-button.svelte";
import { Badge } from "$components/ui/badge";
import { Button } from "$components/ui/button";
import { authClient } from "$lib/auth-client";

const session = authClient.useSession();

$: isPending = $session.isPending;
$: user = $session.data?.user;
$: role = (user as any)?.role as "admin" | "contributor" | "user";
</script>

<div class="p-4 pt-8 px-16 justify-between items-center flex">
  {#if !page.route.id?.startsWith("/(auth)/")}
  <div class="text-xl font-bold">Watchlist</div>
  {/if}
  <div class="flex items-center gap-2">
    {#if role === 'admin' || role === 'contributor'}
      <Badge variant='outline' class='border-accent'>
        {role[0].toUpperCase() + role.slice(1)}
      </Badge>
    {/if}
    {#if user}
      <Button variant="outline" class="flex items-center gap-2">
        <UserRoundIcon size={16} /> {user.username}
      </Button>
      <LogoutButton class=''/>
    {/if}
    {#if !isPending && !user && !page.route.id?.startsWith("/(auth)/")}
      <Button variant="outline" class="flex items-center gap-2" onclick={() => goto("/login")}>
        <LogInIcon size={16} class='text-accent' /> Login
      </Button>
    {/if}
    {#if isPending && !page.route.id?.startsWith("/(auth)/")}
      <Button variant="outline" class="flex items-center gap-2">
        <LoaderCircleIcon size={16} /> Loading...
      </Button>
    {/if}
  </div>
</div>
