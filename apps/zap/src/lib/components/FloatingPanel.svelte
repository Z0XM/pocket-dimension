<script lang="ts">
  import Maximize2Icon from "@lucide/svelte/icons/maximize-2";
  import Minimize2Icon from "@lucide/svelte/icons/minimize-2";
  import MinusIcon from "@lucide/svelte/icons/minus";
  import GripIcon from "@lucide/svelte/icons/grip-horizontal";
  import { onMount, type Snippet } from "svelte";
  import {
    ICON_SIZE,
    clampPoint,
    clampRect,
    defaultIconPos,
    defaultPanelSize,
    inDropZone,
    panelRectNearIcon,
    parseStoredFloating,
    type DropTone,
    type FloatingMode,
    type Point,
    type Rect,
    type Viewport,
  } from "$lib/floating-panel";

  let {
    id,
    title,
    slot = 0,
    active = false,
    badge = null,
    dropLabel = null,
    dropTone = "dock",
    /** Force the panel into this mode once after mount (e.g. maximize from dock). */
    openAs = null,
    /**
     * Leaving fullscreen: return true if the parent handled restore (e.g. re-dock).
     * Used so maximize-from-dock → minimize returns to the footer, not a floating panel.
     */
    onExitFull = null,
    ondrop,
    icon,
    header,
    children,
  }: {
    /** localStorage key suffix for position / size / mode. */
    id: string;
    title: string;
    /** Default stacking slot from the bottom-right corner. */
    slot?: number;
    /** Glow the icon (e.g. while playing). */
    active?: boolean;
    badge?: string | number | null;
    /** When set, dragging into the bottom edge shows this label and calls `ondrop` on release. */
    dropLabel?: string | null;
    dropTone?: DropTone;
    openAs?: FloatingMode | null;
    onExitFull?: (() => boolean) | null;
    ondrop?: () => void;
    icon: Snippet;
    header?: Snippet;
    children: Snippet<[{ mode: FloatingMode }]>;
  } = $props();

  const storageKey = $derived(`zap.float.${id}`);

  let mode = $state<FloatingMode>("icon");
  let iconPos = $state<Point>({ x: -999, y: -999 });
  let panel = $state<Rect | null>(null);
  let ready = $state(false);

  type Drag = { kind: "icon" | "panel" | "resize"; startX: number; startY: number; origin: Rect; moved: boolean };
  let drag: Drag | null = null;
  let dragging = $state(false);
  let overDrop = $state(false);
  let suppressClick = false;

  function viewport(): Viewport {
    return { w: window.innerWidth, h: window.innerHeight };
  }

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ mode, icon: iconPos, panel }));
    } catch {
      // storage unavailable
    }
  }

  function reclamp() {
    const vp = viewport();
    iconPos = clampPoint(iconPos, { w: ICON_SIZE, h: ICON_SIZE }, vp);
    if (panel) panel = clampRect(panel, vp);
  }

  onMount(() => {
    const vp = viewport();
    let stored = parseStoredFloating(null);
    try {
      stored = parseStoredFloating(localStorage.getItem(storageKey));
    } catch {
      // ignore
    }
    iconPos = stored.icon ? clampPoint(stored.icon, { w: ICON_SIZE, h: ICON_SIZE }, vp) : defaultIconPos(vp, slot);
    panel = stored.panel ? clampRect(stored.panel, vp) : null;
    mode = openAs === "panel" || openAs === "full" || openAs === "icon" ? openAs : stored.mode;
    if ((mode === "panel" || mode === "full") && !panel) {
      panel = panelRectNearIcon(iconPos, defaultPanelSize(vp), vp);
    }
    ready = true;
    persist();
    const onResize = () => reclamp();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  });

  $effect(() => {
    if (mode !== "full") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMode("panel");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function setMode(next: FloatingMode) {
    // Maximize-from-dock: parent re-docks instead of collapsing to a floating panel/icon.
    if (mode === "full" && next !== "full" && onExitFull?.()) return;
    if (next === "panel" && !panel) panel = panelRectNearIcon(iconPos, defaultPanelSize(viewport()), viewport());
    mode = next;
    persist();
  }

  function startDrag(e: PointerEvent, kind: Drag["kind"]) {
    if (e.button !== 0) return;
    if (kind === "panel" && (e.target as HTMLElement).closest("button, input, a, [data-no-drag]")) return;
    const origin: Rect = kind === "icon" ? { ...iconPos, w: ICON_SIZE, h: ICON_SIZE } : { ...(panel ?? { x: 0, y: 0, w: 0, h: 0 }) };
    drag = { kind, startX: e.clientX, startY: e.clientY, origin, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (kind !== "icon") e.preventDefault();
  }

  function moveDrag(e: PointerEvent) {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    dragging = true;
    const vp = viewport();
    const o = drag.origin;
    if (drag.kind === "icon") iconPos = clampPoint({ x: o.x + dx, y: o.y + dy }, { w: ICON_SIZE, h: ICON_SIZE }, vp);
    else if (drag.kind === "panel") panel = clampRect({ ...o, x: o.x + dx, y: o.y + dy }, vp);
    else panel = clampRect({ ...o, w: o.w + dx, h: o.h + dy }, vp);
    overDrop = Boolean(dropLabel) && drag.kind !== "resize" && inDropZone(e.clientY, vp);
  }

  function endDrag() {
    const d = drag;
    drag = null;
    dragging = false;
    if (!d) return;
    if (d.moved) suppressClick = d.kind === "icon";
    if (d.moved && overDrop) {
      overDrop = false;
      // Snap back visually; the parent typically unmounts us (e.g. docks to the footer).
      if (d.kind === "icon") iconPos = { x: d.origin.x, y: d.origin.y };
      else panel = { ...d.origin };
      mode = "icon";
      persist();
      ondrop?.();
      return;
    }
    overDrop = false;
    if (d.moved) persist();
  }

  function onIconClick() {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    setMode("panel");
  }

  const dropBandClass = $derived(
    dropTone === "danger"
      ? overDrop
        ? "border-destructive bg-destructive/25 text-destructive"
        : "border-destructive/40 bg-destructive/10 text-destructive/80"
      : overDrop
        ? "border-signal bg-signal/20 text-signal"
        : "border-signal/40 bg-signal/10 text-signal/80"
  );
</script>

{#if ready}
  {#if dragging && dropLabel}
    <div
      class={`pointer-events-none fixed inset-x-0 bottom-0 z-[45] flex h-[72px] items-center justify-center border-t font-mono text-[11px] tracking-[0.14em] uppercase transition-colors ${dropBandClass}`}
      aria-hidden="true"
    >
      {dropLabel}
    </div>
  {/if}

  {#if mode === "icon"}
    <button
      type="button"
      class={`zap-float-icon fixed z-40 flex touch-none items-center justify-center rounded-full border bg-popover/95 text-signal shadow-lg backdrop-blur transition-shadow select-none ${
        active ? "border-signal/70 shadow-[0_0_18px_color-mix(in_srgb,var(--signal)_35%,transparent)]" : "border-border hover:border-signal/50"
      } ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={`left:${iconPos.x}px;top:${iconPos.y}px;width:${ICON_SIZE}px;height:${ICON_SIZE}px`}
      aria-label={`Open ${title}`}
      title={dropLabel ? `${title} — drag to the footer to dock` : title}
      onpointerdown={(e) => startDrag(e, "icon")}
      onpointermove={moveDrag}
      onpointerup={endDrag}
      onpointercancel={endDrag}
      onclick={onIconClick}
    >
      {@render icon()}
      {#if badge != null && badge !== ""}
        <span
          class="absolute -top-1 -right-1 min-w-5 rounded-full border border-background bg-signal px-1 text-center font-mono text-[10px] leading-4 text-primary-foreground tabular-nums"
          >{badge}</span
        >
      {/if}
    </button>
  {:else}
    <div
      class={`zap-float-panel fixed z-[41] flex flex-col overflow-hidden border border-signal/30 bg-popover/95 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur ${
        mode === "full" ? "inset-2 rounded-lg sm:inset-6" : "rounded-lg"
      }`}
      style={mode === "panel" && panel ? `left:${panel.x}px;top:${panel.y}px;width:${panel.w}px;height:${panel.h}px` : undefined}
      role="dialog"
      aria-label={title}
    >
      <div
        class={`flex shrink-0 items-center gap-2 border-b border-border/60 px-2 py-1.5 select-none ${mode === "panel" ? "cursor-grab touch-none" : ""}`}
        onpointerdown={(e) => mode === "panel" && startDrag(e, "panel")}
        onpointermove={moveDrag}
        onpointerup={endDrag}
        onpointercancel={endDrag}
        role="presentation"
      >
        {#if mode === "panel"}
          <GripIcon class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        {/if}
        <span class="shrink-0 text-signal">{@render icon()}</span>
        <p class="min-w-0 flex-1 truncate font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">{title}</p>
        {@render header?.()}
        <button
          type="button"
          class="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-signal/10 hover:text-signal"
          aria-label={mode === "full" ? "Exit fullscreen" : "Fullscreen"}
          title={mode === "full" ? "Exit fullscreen" : "Fullscreen"}
          onclick={() => setMode(mode === "full" ? "panel" : "full")}
        >
          {#if mode === "full"}
            <Minimize2Icon class="size-3.5" />
          {:else}
            <Maximize2Icon class="size-3.5" />
          {/if}
        </button>
        <button
          type="button"
          class="inline-flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-signal/10 hover:text-signal"
          aria-label="Collapse"
          title="Collapse"
          onclick={() => setMode("icon")}
        >
          <MinusIcon class="size-3.5" />
        </button>
      </div>
      <div class="flex min-h-0 flex-1 flex-col">
        {@render children({ mode })}
      </div>
      {#if mode === "panel"}
        <div
          class="absolute right-0 bottom-0 size-4 cursor-nwse-resize touch-none"
          style="background: linear-gradient(135deg, transparent 50%, color-mix(in srgb, var(--signal) 45%, transparent) 50%)"
          onpointerdown={(e) => startDrag(e, "resize")}
          onpointermove={moveDrag}
          onpointerup={endDrag}
          onpointercancel={endDrag}
          role="presentation"
          title="Resize"
        ></div>
      {/if}
    </div>
  {/if}
{/if}
