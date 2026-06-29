<script lang="ts">
  import { goto } from "$app/navigation";
  import { DropdownMenu } from "bits-ui";
  import LogOutIcon from "@lucide/svelte/icons/log-out";
  import ShieldIcon from "@lucide/svelte/icons/shield";
  import UserIcon from "@lucide/svelte/icons/user";
  import { authClient } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button";
  import { cn } from "$lib/utils.js";

  type Props = {
    email: string;
    username: string | null;
    isAdmin: boolean;
  };

  let { email, username, isAdmin }: Props = $props();

  const displayLabel = $derived(username?.trim() || email.split("@")[0] || email);

  let open = $state(false);
  let loggingOut = $state(false);

  async function logout() {
    loggingOut = true;
    open = false;
    try {
      await authClient.signOut();
      await goto("/login");
    } catch (error) {
      console.error(error);
      loggingOut = false;
    }
  }

  function goToAdmin() {
    if (!isAdmin) return;
    open = false;
    void goto("/admin");
  }
</script>

<DropdownMenu.Root bind:open>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="outline" size="icon" class="size-9 rounded-full" aria-label="Account menu">
        <UserIcon class="size-4 text-participant-orange" />
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>

  <DropdownMenu.Portal>
    <DropdownMenu.Content
      align="end"
      sideOffset={8}
      class={cn(
        "z-50 min-w-44 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
      )}
    >
      <div class="truncate px-2 py-1.5 text-xs text-muted-foreground" title={email}>{displayLabel}</div>
      <DropdownMenu.Separator class="my-1 h-px bg-border" />

      {#if isAdmin}
        <DropdownMenu.Item
          class="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none focus:bg-secondary"
          onSelect={goToAdmin}
        >
          <ShieldIcon class="size-4" />
          Admin
        </DropdownMenu.Item>
      {/if}

      <DropdownMenu.Item
        class="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive outline-none select-none focus:bg-destructive/10"
        disabled={loggingOut}
        onSelect={() => void logout()}
      >
        <LogOutIcon class="size-4" />
        {loggingOut ? "Logging out…" : "Log out"}
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
