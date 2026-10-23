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
    MOTION_ANIM_OPACITY,
    MOTION_CARD_OPACITY,
    MOTION_RESPONSE_MS,
    MOTION_WAVE_HISTORY_MS,
    PAGE_PRESETS,
    persistAndApplyTheme,
    readThemePrefs,
    type AccentId,
    type AnimationLayer,
    type AnimationStyleId,
    type CardId,
    type PageId,
    type ZapThemePrefs,
  } from "$lib/theme-prefs";

  let prefs = $state<ZapThemePrefs>({ ...DEFAULT_THEME_PREFS });

  const showWaveHistory = $derived(prefs.animationStyle === "scope" || prefs.animationStyle === "mirror");

  onMount(() => {
    prefs = readThemePrefs();
  });

  function patch( partial: Partial<ZapThemePrefs>) {
    prefs = { ...prefs, ...partial };
    persistAndApplyTheme(prefs);
  }

  function setAccent(id: AccentId) {
    patch({ accent: id });
  }

  function setPage(id: PageId) {
    patch({ page: id });
  }

  function setCard(id: CardId) {
    patch({ card: id });
  }

  function setAnimations(on: boolean) {
    patch({ animations: on });
  }

  function setAnimationStyle(id: AnimationStyleId) {
    patch({ animationStyle: id });
  }

  function setLayer(layer: AnimationLayer) {
    patch({ animationLayer: layer });
  }

  function onCardOpacity(e: Event) {
    patch({ cardOpacity: Number((e.currentTarget as HTMLInputElement).value) });
  }

  function onAnimOpacity(e: Event) {
    patch({ animationOpacity: Number((e.currentTarget as HTMLInputElement).value) });
  }

  function onResponse(e: Event) {
    patch({ responseWindowMs: Number((e.currentTarget as HTMLInputElement).value) });
  }

  function onWaveHistory(e: Event) {
    patch({ waveHistoryMs: Number((e.currentTarget as HTMLInputElement).value) });
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
          Master switch for beat-reactive visuals. Cards stay opaque when off.
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

    <div class={`space-y-3 ${prefs.animations ? "" : "pointer-events-none opacity-45"}`}>
      <div role="listbox" aria-label="Animation style" aria-disabled={!prefs.animations}>
        <p class="mb-2 font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Style</p>
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

      <div class="space-y-3 border border-border/70 bg-card p-3">
        <label class="block space-y-1.5">
          <span class="flex items-baseline justify-between gap-2">
            <span class="text-sm text-foreground">Card opacity</span>
            <span class="font-mono text-[10px] text-muted-foreground tabular-nums"
              >{Math.round(prefs.cardOpacity * 100)}%</span
            >
          </span>
          <input
            class="zap-seek h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-[var(--signal)]"
            type="range"
            min={MOTION_CARD_OPACITY.min}
            max={MOTION_CARD_OPACITY.max}
            step={MOTION_CARD_OPACITY.step}
            value={prefs.cardOpacity}
            disabled={!prefs.animations}
            aria-label="Card opacity"
            oninput={onCardOpacity}
          />
          <span class="block font-mono text-[9px] text-muted-foreground">How see-through UI cards are while animations run.</span>
        </label>

        <label class="block space-y-1.5">
          <span class="flex items-baseline justify-between gap-2">
            <span class="text-sm text-foreground">Animation opacity</span>
            <span class="font-mono text-[10px] text-muted-foreground tabular-nums"
              >{Math.round(prefs.animationOpacity * 100)}%</span
            >
          </span>
          <input
            class="zap-seek h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-[var(--signal)]"
            type="range"
            min={MOTION_ANIM_OPACITY.min}
            max={MOTION_ANIM_OPACITY.max}
            step={MOTION_ANIM_OPACITY.step}
            value={prefs.animationOpacity}
            disabled={!prefs.animations}
            aria-label="Animation opacity"
            oninput={onAnimOpacity}
          />
        </label>

        <div class="space-y-1.5">
          <span class="block text-sm text-foreground">Layer</span>
          <div class="flex gap-2" role="group" aria-label="Animation layer">
            <button
              type="button"
              disabled={!prefs.animations}
              class={`flex-1 border px-3 py-1.5 font-mono text-[11px] ${
                prefs.animationLayer === "behind" ? "border-signal bg-signal/10 text-signal" : "border-border text-muted-foreground"
              }`}
              aria-pressed={prefs.animationLayer === "behind"}
              onclick={() => setLayer("behind")}
            >
              Behind UI
            </button>
            <button
              type="button"
              disabled={!prefs.animations}
              class={`flex-1 border px-3 py-1.5 font-mono text-[11px] ${
                prefs.animationLayer === "top" ? "border-signal bg-signal/10 text-signal" : "border-border text-muted-foreground"
              }`}
              aria-pressed={prefs.animationLayer === "top"}
              onclick={() => setLayer("top")}
            >
              On top
            </button>
          </div>
          <span class="block font-mono text-[9px] text-muted-foreground">Stack the visualizer under chrome or over the whole UI.</span>
        </div>

        <label class="block space-y-1.5">
          <span class="flex items-baseline justify-between gap-2">
            <span class="text-sm text-foreground">Response window</span>
            <span class="font-mono text-[10px] text-muted-foreground tabular-nums">
              {prefs.responseWindowMs === 0 ? "Instant" : `${prefs.responseWindowMs} ms`}
            </span>
          </span>
          <input
            class="zap-seek h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-[var(--signal)]"
            type="range"
            min={MOTION_RESPONSE_MS.min}
            max={MOTION_RESPONSE_MS.max}
            step={MOTION_RESPONSE_MS.step}
            value={prefs.responseWindowMs}
            disabled={!prefs.animations}
            aria-label="Response window"
            oninput={onResponse}
          />
          <span class="block font-mono text-[9px] text-muted-foreground">
            0 = live frame. Higher averages/peaks energy over a short buffer before driving the visualizer.
          </span>
        </label>

        <label class={`block space-y-1.5 ${showWaveHistory ? "" : "opacity-45"}`}>
          <span class="flex items-baseline justify-between gap-2">
            <span class="text-sm text-foreground">Wave history</span>
            <span class="font-mono text-[10px] text-muted-foreground tabular-nums">
              {prefs.waveHistoryMs === 0 ? "Live" : `${(prefs.waveHistoryMs / 1000).toFixed(2)} s`}
            </span>
          </span>
          <input
            class="zap-seek h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-[var(--signal)]"
            type="range"
            min={MOTION_WAVE_HISTORY_MS.min}
            max={MOTION_WAVE_HISTORY_MS.max}
            step={MOTION_WAVE_HISTORY_MS.step}
            value={prefs.waveHistoryMs}
            disabled={!prefs.animations || !showWaveHistory}
            aria-label="Wave history"
            oninput={onWaveHistory}
          />
          <span class="block font-mono text-[9px] text-muted-foreground">
            Oscilloscope & Mirrored wave: Live = current buffer; longer scrolls left with newest on the right (up to 1 s).
          </span>
        </label>
      </div>
    </div>
  </section>
</div>
