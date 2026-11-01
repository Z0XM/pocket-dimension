<script lang="ts">
  import CableIcon from "@lucide/svelte/icons/cable";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import LogOutIcon from "@lucide/svelte/icons/log-out";
  import MenuIcon from "@lucide/svelte/icons/menu";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import ShieldIcon from "@lucide/svelte/icons/shield";
  import PaletteIcon from "@lucide/svelte/icons/palette";
  import XIcon from "@lucide/svelte/icons/x";

  let {
    username = null,
    isAdmin = false,
    onSignOut,
    /** Compact app menu: primary routes + settings behind one trigger (small screens). */
    includePrimary = false,
    catalogueActive = false,
    playlistsActive = false,
    sessionActive = false,
    jobsActive = false,
    runningImportJobs = 0,
    showRunningJobs = false,
  }: {
    username?: string | null;
    isAdmin?: boolean;
    onSignOut: () => void | Promise<void>;
    includePrimary?: boolean;
    catalogueActive?: boolean;
    playlistsActive?: boolean;
    sessionActive?: boolean;
    jobsActive?: boolean;
    runningImportJobs?: number;
    showRunningJobs?: boolean;
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

  function itemClass(active: boolean) {
    return `flex items-center gap-2 px-3 py-2.5 ${active ? "text-signal" : "text-foreground"}`;
  }
</script>

<svelte:document onpointerdown={onDocPointerDown} onkeydown={onKeydown} />

<div class="relative" bind:this={rootEl}>
  <button
    type="button"
    class="zap-settings-trigger inline-flex size-8 items-center justify-center border border-border text-muted-foreground hover:border-signal/50 hover:text-signal"
    aria-label={includePrimary ? (open ? "Close menu" : "Open menu") : "Settings"}
    aria-haspopup="menu"
    aria-expanded={open}
    onclick={toggle}
  >
    {#if includePrimary}
      {#if open}
        <XIcon class="size-4" aria-hidden="true" />
      {:else}
        <MenuIcon class="size-4" aria-hidden="true" />
      {/if}
    {:else}
      <SettingsIcon class="size-4" aria-hidden="true" />
    {/if}
  </button>

  {#if open}
    <div
      class="zap-dropdown zap-settings-panel absolute top-[calc(100%+0.4rem)] right-0 z-[70] w-[min(calc(100vw-2rem),18.5rem)]"
      role="menu"
      aria-label={includePrimary ? "Navigation and settings" : "Settings"}
    >
      <div class="border-b border-border px-3 py-2">
        <p class="truncate font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
          {username ?? "Account"}
        </p>
      </div>
      <ul class="py-1 font-mono text-[11px]">
        {#if includePrimary}
          <li>
            <a
              href="/catalogue"
              role="menuitem"
              class={itemClass(catalogueActive)}
              aria-current={catalogueActive ? "page" : undefined}
              onclick={close}
            >
              Catalogue
            </a>
          </li>
          <li>
            <a
              href="/playlists"
              role="menuitem"
              class={itemClass(playlistsActive)}
              aria-current={playlistsActive ? "page" : undefined}
              onclick={close}
            >
              Playlists
            </a>
          </li>
          <li>
            <a
              href="/session?stay=1"
              role="menuitem"
              class={itemClass(sessionActive)}
              aria-current={sessionActive ? "page" : undefined}
              onclick={close}
            >
              Sessions
            </a>
          </li>
          {#if showRunningJobs}
            <li>
              <a href="/jobs" role="menuitem" class={itemClass(jobsActive)} aria-current={jobsActive ? "page" : undefined} onclick={close}>
                Running Jobs{#if runningImportJobs > 0}
                  <span class="ml-1 tabular-nums text-signal">({runningImportJobs})</span>{/if}
              </a>
            </li>
          {/if}
          <li class="my-1 border-t border-border" aria-hidden="true"></li>
        {/if}
        <li>
          <a href="/connections" role="menuitem" class="flex items-center gap-2 px-3 py-2.5 text-foreground" onclick={close}>
            <CableIcon class="size-3.5 shrink-0" aria-hidden="true" />
            Connections
          </a>
        </li>
        <li>
          <a href="/history" role="menuitem" class="flex items-center gap-2 px-3 py-2.5 text-foreground" onclick={close}>
            <HistoryIcon class="size-3.5 shrink-0" aria-hidden="true" />
            History
          </a>
        </li>
        {#if isAdmin}
          <li>
            <a href="/admin" role="menuitem" class="flex items-center gap-2 px-3 py-2.5 text-foreground" onclick={close}>
              <ShieldIcon class="size-3.5 shrink-0" aria-hidden="true" />
              Admin
            </a>
          </li>
        {/if}
        <li>
          <a href="/theme" role="menuitem" class="flex items-center gap-2 px-3 py-2.5 text-foreground" onclick={close}>
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
