<script lang="ts">
  import AppWindowIcon from "@lucide/svelte/icons/app-window";
  import LayoutPanelTopIcon from "@lucide/svelte/icons/layout-panel-top";
  import PaletteIcon from "@lucide/svelte/icons/palette";
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

  let prefs = $state<ZapThemePrefs>({ ...DEFAULT_THEME_PREFS });

  onMount(() => {
    prefs = readThemePrefs();
  });

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
</script>

<div class="space-y-8">
  <section class="space-y-3">
    <h2 class="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
      <PaletteIcon class="size-3.5 shrink-0 text-signal" aria-hidden="true" />
      Accent
    </h2>
    <div class="grid grid-cols-4 gap-2 sm:grid-cols-8" role="listbox" aria-label="Accent color">
      {#each ACCENT_PRESETS as preset (preset.id)}
        <button
          type="button"
          role="option"
          aria-selected={prefs.accent === preset.id}
          title={preset.label}
          class={`flex flex-col items-center gap-1.5 border p-2 ${
            prefs.accent === preset.id ? "border-signal" : "border-border hover:border-signal/40"
          }`}
          onclick={() => setAccent(preset.id)}
        >
          <span class="size-8 border border-white/15" style={`background:${preset.value}`} aria-hidden="true"></span>
          <span class="font-mono text-[9px] text-muted-foreground">{preset.label}</span>
        </button>
      {/each}
    </div>
  </section>

  <section class="space-y-3">
    <h2 class="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
      <AppWindowIcon class="size-3.5 shrink-0 text-signal" aria-hidden="true" />
      Page background
    </h2>
    <div class="grid grid-cols-4 gap-2 sm:grid-cols-7" role="listbox" aria-label="Page background">
      {#each PAGE_PRESETS as preset (preset.id)}
        <button
          type="button"
          role="option"
          aria-selected={prefs.page === preset.id}
          title={preset.label}
          class={`flex flex-col items-center gap-1.5 border p-2 ${
            prefs.page === preset.id ? "border-signal" : "border-border hover:border-signal/40"
          }`}
          onclick={() => setPage(preset.id)}
        >
          <span class="size-8 border border-white/15" style={`background:${preset.value}`} aria-hidden="true"></span>
          <span class="text-center font-mono text-[8px] leading-tight text-muted-foreground">{preset.label}</span>
        </button>
      {/each}
    </div>
  </section>

  <section class="space-y-3">
    <h2 class="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
      <LayoutPanelTopIcon class="size-3.5 shrink-0 text-signal" aria-hidden="true" />
      Cards & windows
    </h2>
    <div class="grid grid-cols-3 gap-2 sm:grid-cols-6" role="listbox" aria-label="Card background">
      {#each CARD_PRESETS as preset (preset.id)}
        <button
          type="button"
          role="option"
          aria-selected={prefs.card === preset.id}
          title={preset.label}
          class={`flex flex-col items-center gap-1.5 border p-2 ${
            prefs.card === preset.id ? "border-signal" : "border-border hover:border-signal/40"
          }`}
          onclick={() => setCard(preset.id)}
        >
          <span class="size-8 border border-white/15" style={`background:${preset.value}`} aria-hidden="true"></span>
          <span class="text-center font-mono text-[8px] leading-tight text-muted-foreground">{preset.label}</span>
        </button>
      {/each}
    </div>
  </section>
</div>
