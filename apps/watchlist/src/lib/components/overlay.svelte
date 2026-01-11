<script lang="ts">
import { LoaderCircleIcon, LogInIcon, MenuIcon, UserRoundIcon, XIcon } from "@lucide/svelte";
import { goto } from "$app/navigation";
import { page } from "$app/state";
import LogoutButton from "$components/logout-button.svelte";
import { Badge } from "$components/ui/badge";
import { Button } from "$components/ui/button";
import * as DropdownMenu from "$components/ui/dropdown-menu";
import { authClient } from "$lib/auth-client";

const session = authClient.useSession();

let isPending = $derived($session.isPending);
let user = $derived($session.data?.user);
let role = $derived((user as any)?.role as "admin" | "contributor" | "user");

let mobileMenuOpen = $state(false);
</script>

<div class="p-4 pt-8 px-4 sm:px-8 md:px-16 justify-between items-center flex">
  {#if !page.route.id?.startsWith("/(auth)/")}
  <div class="text-xl font-bold">Watchlist</div>
  {/if}

  <!-- Desktop menu - hidden on mobile/tablet -->
  <div class="hidden md:flex items-center gap-2">
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
        <LoaderCircleIcon size={16} class='animate-spin' /> Loading...
      </Button>
    {/if}
  </div>

  <!-- Mobile/Tablet menu button - visible only on mobile/tablet -->
  <div class="md:hidden">
    <DropdownMenu.Root bind:open={mobileMenuOpen}>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button
            variant="outline"
            size="icon"
            {...props}
            class="flex items-center justify-center"
            aria-label="Menu"
          >
            {#if mobileMenuOpen}
              <XIcon size={20} />
            {:else}
              <MenuIcon size={20} />
            {/if}
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content class="bg-white/1 backdrop-blur-md" align="end">
        {#if role === 'admin' || role === 'contributor'}
          <div class="px-2 py-1.5">
            <Badge variant='outline' class='border-accent'>
              {role[0].toUpperCase() + role.slice(1)}
            </Badge>
          </div>
        {/if}
        {#if user}
          <DropdownMenu.Item class="flex items-center gap-2 cursor-default">
            <UserRoundIcon size={16} />
            <span>{user.username}</span>
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <div class="px-2 py-1">
            <LogoutButton class="" />
          </div>
        {/if}
        {#if !isPending && !user && !page.route.id?.startsWith("/(auth)/")}
          <DropdownMenu.Item
            class="flex items-center gap-2 cursor-pointer"
            onSelect={() => { mobileMenuOpen = false; goto("/login"); }}
          >
            <LogInIcon size={16} class='text-accent' />
            <span>Login</span>
          </DropdownMenu.Item>
        {/if}
        {#if isPending && !page.route.id?.startsWith("/(auth)/")}
          <DropdownMenu.Item class="flex items-center gap-2 cursor-default">
            <LoaderCircleIcon size={16} class='animate-spin' />
            <span>Loading...</span>
          </DropdownMenu.Item>
        {/if}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
</div>
