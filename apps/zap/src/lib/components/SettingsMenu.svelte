<script lang="ts">
  import HistoryIcon from "@lucide/svelte/icons/history";
  import LogOutIcon from "@lucide/svelte/icons/log-out";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import ShieldIcon from "@lucide/svelte/icons/shield";
  import PaletteIcon from "@lucide/svelte/icons/palette";

  let {
    username = null,
    isAdmin = false,
    onSignOut,
  }: {
    username?: string | null;
    isAdmin?: boolean;
    onSignOut: () => void | Promise<void>;
  } = $props();

  let open = $state(false);
  let rootEl = $state<HTMLDivElement | null>(null);

  function toggle() {
    open = !open;
  }

  function close() {
    open = false;
  }

  function onDocPointerDown(e: PointerEvent) {
    if (!open || !rootEl) return;
    if (e.target instanceof Node && !rootEl.contains(e.target)) close();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      close();
    }
  }
</script>

<svelte:document onpointerdown={onDocPointerDown} onkeydown={onKeydown} />

<div class="relative" bind:this={rootEl}>
  <button
    type="button"
    class="zap-settings-trigger inline-flex size-8 items-center justify-center border border-border text-muted-foreground hover:border-signal/50 hover:text-signal"
    aria-label="Settings"
    aria-haspopup="menu"
    aria-expanded={open}
    onclick={toggle}
  >
    <SettingsIcon class="size-4" aria-hidden="true" />
  </button>

  {#if open}
    <div
      class="zap-settings-panel absolute top-[calc(100%+0.4rem)] right-0 z-[70] w-[min(calc(100vw-2rem),18.5rem)] border-2 border-border bg-popover text-popover-foreground shadow-none"
      role="menu"
      aria-label="Settings"
    >
      <div class="border-b border-border px-3 py-2">
        <p class="truncate font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
          {username ?? "Account"}
        </p>
      </div>
      <ul class="py-1 font-mono text-[11px]">
        <li>
          <a
            href="/history"
            role="menuitem"
            class="flex items-center gap-2 px-3 py-2.5 text-foreground hover:bg-signal/10 hover:text-signal"
            onclick={close}
          >
            <HistoryIcon class="size-3.5 shrink-0" aria-hidden="true" />
            History
          </a>
        </li>
        {#if isAdmin}
          <li>
            <a
              href="/admin"
              role="menuitem"
              class="flex items-center gap-2 px-3 py-2.5 text-foreground hover:bg-signal/10 hover:text-signal"
              onclick={close}
            >
              <ShieldIcon class="size-3.5 shrink-0" aria-hidden="true" />
              Admin
            </a>
          </li>
        {/if}
        <li>
          <a
            href="/theme"
            role="menuitem"
            class="flex items-center gap-2 px-3 py-2.5 text-foreground hover:bg-signal/10 hover:text-signal"
            onclick={close}
          >
            <PaletteIcon class="size-3.5 shrink-0" aria-hidden="true" />
            Theme
          </a>
        </li>
        <li>
          <button
            type="button"
            role="menuitem"
            class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-destructive hover:bg-destructive/10"
            onclick={() => {
              close();
              void onSignOut();
            }}
          >
            <LogOutIcon class="size-3.5 shrink-0" aria-hidden="true" />
            Log out
          </button>
        </li>
      </ul>
    </div>
  {/if}
</div>
