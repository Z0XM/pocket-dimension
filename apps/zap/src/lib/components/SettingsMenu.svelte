<script lang="ts">
  import HistoryIcon from "@lucide/svelte/icons/history";
  import LogOutIcon from "@lucide/svelte/icons/log-out";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import ShieldIcon from "@lucide/svelte/icons/shield";
  import PaletteIcon from "@lucide/svelte/icons/palette";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import { onMount } from "svelte";
  import {
    ACCENT_PRESETS,
    CARD_PRESETS,
    DEFAULT_THEME_PREFS,
    PAGE_PRESETS,
    persistAndApplyTheme,
    readThemePrefs,
    type AccentId,
    type CardId,
    type PageId,
    type ZapThemePrefs,
  } from "$lib/theme-prefs";

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
  let view = $state<"menu" | "theme">("menu");
  let prefs = $state<ZapThemePrefs>({ ...DEFAULT_THEME_PREFS });
  let rootEl = $state<HTMLDivElement | null>(null);

  onMount(() => {
    prefs = readThemePrefs();
  });

  function toggle() {
    open = !open;
    if (open) view = "menu";
  }

  function close() {
    open = false;
    view = "menu";
  }

  function setAccent(id: AccentId) {
    prefs = { ...prefs, accent: id };
    persistAndApplyTheme(prefs);
  }

  function setPage(id: PageId) {
    prefs = { ...prefs, page: id };
    persistAndApplyTheme(prefs);
  }

  function setCard(id: CardId) {
    prefs = { ...prefs, card: id };
    persistAndApplyTheme(prefs);
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
      aria-label={view === "theme" ? "Theme" : "Settings"}
    >
      {#if view === "menu"}
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
            <button
              type="button"
              role="menuitem"
              class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-foreground hover:bg-signal/10 hover:text-signal"
              onclick={() => (view = "theme")}
            >
              <PaletteIcon class="size-3.5 shrink-0" aria-hidden="true" />
              Theme
            </button>
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
      {:else}
        <div class="flex items-center gap-1 border-b border-border px-2 py-1.5">
          <button
            type="button"
            class="inline-flex size-7 items-center justify-center text-muted-foreground hover:text-signal"
            aria-label="Back to settings"
            onclick={() => (view = "menu")}
          >
            <ChevronLeftIcon class="size-4" aria-hidden="true" />
          </button>
          <p class="font-mono text-[10px] tracking-[0.16em] text-signal uppercase">Theme</p>
        </div>

        <div class="max-h-[min(70vh,28rem)] space-y-4 overflow-y-auto p-3">
          <section class="space-y-2">
            <h3 class="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Accent</h3>
            <div class="grid grid-cols-4 gap-2" role="listbox" aria-label="Accent color">
              {#each ACCENT_PRESETS as preset (preset.id)}
                <button
                  type="button"
                  role="option"
                  aria-selected={prefs.accent === preset.id}
                  title={preset.label}
                  class={`flex flex-col items-center gap-1 border p-1.5 ${
                    prefs.accent === preset.id ? "border-signal" : "border-border hover:border-signal/40"
                  }`}
                  onclick={() => setAccent(preset.id)}
                >
                  <span class="size-7 border border-white/15" style={`background:${preset.value}`} aria-hidden="true"></span>
                  <span class="font-mono text-[9px] text-muted-foreground">{preset.label}</span>
                </button>
              {/each}
            </div>
          </section>

          <section class="space-y-2">
            <h3 class="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Page background</h3>
            <div class="grid grid-cols-4 gap-2" role="listbox" aria-label="Page background">
              {#each PAGE_PRESETS as preset (preset.id)}
                <button
                  type="button"
                  role="option"
                  aria-selected={prefs.page === preset.id}
                  title={preset.label}
                  class={`flex flex-col items-center gap-1 border p-1.5 ${
                    prefs.page === preset.id ? "border-signal" : "border-border hover:border-signal/40"
                  }`}
                  onclick={() => setPage(preset.id)}
                >
                  <span class="size-7 border border-white/15" style={`background:${preset.value}`} aria-hidden="true"></span>
                  <span class="text-center font-mono text-[8px] leading-tight text-muted-foreground">{preset.label}</span>
                </button>
              {/each}
            </div>
          </section>

          <section class="space-y-2">
            <h3 class="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Cards & windows</h3>
            <div class="grid grid-cols-3 gap-2" role="listbox" aria-label="Card background">
              {#each CARD_PRESETS as preset (preset.id)}
                <button
                  type="button"
                  role="option"
                  aria-selected={prefs.card === preset.id}
                  title={preset.label}
                  class={`flex flex-col items-center gap-1 border p-1.5 ${
                    prefs.card === preset.id ? "border-signal" : "border-border hover:border-signal/40"
                  }`}
                  onclick={() => setCard(preset.id)}
                >
                  <span class="size-7 border border-white/15" style={`background:${preset.value}`} aria-hidden="true"></span>
                  <span class="text-center font-mono text-[8px] leading-tight text-muted-foreground">{preset.label}</span>
                </button>
              {/each}
            </div>
          </section>
        </div>
      {/if}
    </div>
  {/if}
</div>
