<script lang="ts">
  import LogoutButton from "$components/logout-button.svelte";
  import { authClient } from "$lib/auth-client";
  import { LogInIcon, UserRoundIcon } from '@lucide/svelte'
  import { Button } from '$components/ui/button';
  import { Badge } from '$components/ui/badge';
  import { goto } from "$app/navigation";
  import { page } from "$app/state";


  const session = authClient.useSession();

  console.log($session);

  $: user = $session.data?.user;
  $: role = (user as any)?.role as 'admin' | 'contributor' | 'user';
</script>

<div class="absolute top-4 right-4 flex items-center gap-2">
  {#if role === 'admin' || role === 'contributor'}
    <Badge variant='outline' class='{role === 'contributor' ?  "border-teal-200": "border-rose-200"}'>
      {role[0].toUpperCase() + role.slice(1)}
    </Badge>
  {/if}
  {#if user}
    <Button variant="outline" class="flex items-center gap-2">
      <UserRoundIcon size={16} /> {user.username}
    </Button>
    <LogoutButton class=''/>
  {/if}
  {#if !user && !page.route.id?.startsWith("/(auth)/")}
    <Button variant="outline" class="flex items-center gap-2" onclick={() => goto("/login")}>
      <LogInIcon size={16} /> Login
    </Button>
  {/if}
</div>
