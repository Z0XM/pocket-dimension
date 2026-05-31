<script lang="ts">
  import { goto } from "$app/navigation";
  import { authClient } from "$lib/auth-client";
  import { Settings } from "@lucide/svelte";

  let open = $state(false);
  let root: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (root && target && !root.contains(target)) {
        open = false;
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") open = false;
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  async function signOut() {
    open = false;
    await authClient.signOut();
    await goto("/login");
  }
</script>

<div class="settings" class:open bind:this={root}>
  <button type="button" class="settings-btn" aria-expanded={open} aria-haspopup="menu" onclick={() => (open = !open)}>
    <Settings size={16} strokeWidth={1.5} aria-hidden="true" />
    Settings
  </button>
  {#if open}
    <div class="settings-menu" role="menu">
      <a href="/app/control" role="menuitem" onclick={() => (open = false)}>Control center</a>
      <button type="button" role="menuitem" onclick={signOut}>Sign out</button>
    </div>
  {/if}
</div>
