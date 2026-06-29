<script lang="ts">
  import { goto } from "$app/navigation";
  import { DropdownMenu } from "bits-ui";
  import LogOutIcon from "@lucide/svelte/icons/log-out";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import UserIcon from "@lucide/svelte/icons/user";
  import { authClient } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button";
  import { cn } from "$lib/utils.js";

  type Props = {
    email: string;
  };

  let { email }: Props = $props();

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

  function goToSettings() {
    open = false;
    void goto("/settings");
  }
</script>

<DropdownMenu.Root bind:open>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="outline" size="icon" class="size-9 rounded-full" aria-label="Account menu">
        <UserIcon class="size-4" />
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
      <div class="truncate px-2 py-1.5 text-xs text-muted-foreground" title={email}>{email}</div>
      <DropdownMenu.Separator class="my-1 h-px bg-border" />

      <DropdownMenu.Item
        class="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none focus:bg-secondary"
        onSelect={goToSettings}
      >
        <SettingsIcon class="size-4" />
        Settings
      </DropdownMenu.Item>

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
