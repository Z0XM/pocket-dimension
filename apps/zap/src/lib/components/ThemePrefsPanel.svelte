<script lang="ts">
  import AppWindowIcon from "@lucide/svelte/icons/app-window";
  import LayoutPanelTopIcon from "@lucide/svelte/icons/layout-panel-top";
  import PaletteIcon from "@lucide/svelte/icons/palette";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import { onMount } from "svelte";
  import {
    ACCENT_PRESETS,
    ANIMATION_STYLES,
    CARD_PRESETS,
    DEFAULT_THEME_PREFS,
    PAGE_PRESETS,
    persistAndApplyTheme,
    readThemePrefs,
    type AccentId,
    type AnimationStyleId,
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

  function setAnimations(on: boolean) {
    prefs = { ...prefs, animations: on };
    persistAndApplyTheme(prefs);
  }

  function setAnimationStyle(id: AnimationStyleId) {
    prefs = { ...prefs, animationStyle: id };
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

  <section class="space-y-3">
    <h2 class="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
      <SparklesIcon class="size-3.5 shrink-0 text-signal" aria-hidden="true" />
      Motion
    </h2>
    <label class="flex items-center justify-between gap-4 border border-border/70 bg-card p-3">
      <span class="min-w-0">
        <span class="block text-sm text-foreground">Animations</span>
        <span class="mt-0.5 block font-mono text-[10px] text-muted-foreground">
          Beat-reactive background and future motion. Cards go translucent while on.
        </span>
      </span>
      <button
        type="button"
        class="zap-toggle shrink-0"
        role="switch"
        aria-checked={prefs.animations}
        aria-label="Animations"
        onclick={() => setAnimations(!prefs.animations)}
      >
        <span class="zap-toggle-thumb"></span>
      </button>
    </label>

    <div
      class={`space-y-2 ${prefs.animations ? "" : "pointer-events-none opacity-45"}`}
      role="listbox"
      aria-label="Animation style"
      aria-disabled={!prefs.animations}
    >
      <p class="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Style</p>
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {#each ANIMATION_STYLES as style (style.id)}
          <button
            type="button"
            role="option"
            aria-selected={prefs.animationStyle === style.id}
            disabled={!prefs.animations}
            class={`border px-3 py-2 text-left ${
              prefs.animationStyle === style.id ? "border-signal bg-signal/10" : "border-border hover:border-signal/40"
            }`}
            onclick={() => setAnimationStyle(style.id)}
          >
            <span class="block text-sm text-foreground">{style.label}</span>
            <span class="mt-0.5 block font-mono text-[9px] leading-snug text-muted-foreground">{style.blurb}</span>
          </button>
        {/each}
      </div>
    </div>
  </section>
</div>
