<script lang="ts">
  import type { Snippet } from "svelte";
  import { browser } from "$app/environment";
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
  import { readStored, writeStored } from "$lib/browser-storage";

  type Props = {
    /** Stable id for persisting position across reloads. */
    id: string;
    title: string;
    ariaLabel: string;
    /** Initial placement before any drag / stored position. */
    defaultPlacement?: "top-right" | "bottom-right";
    widthClass?: string;
    children: Snippet;
  };

  let { id, title, ariaLabel, defaultPlacement = "bottom-right", widthClass = "w-[min(100%-2rem,13.5rem)]", children }: Props = $props();

  type Pos = { left: number; top: number };

  const storageKey = `zeo:dev-card-pos:${id}`;

  let pos = $state<Pos | null>(null);
  let cardEl = $state<HTMLElement | null>(null);
  let dragging = $state(false);

  function defaultPos(): Pos {
    const margin = 16;
    const width = cardEl?.offsetWidth ?? 216;
    const height = cardEl?.offsetHeight ?? 140;
    const left = Math.max(margin, window.innerWidth - width - margin);
    if (defaultPlacement === "top-right") {
      return { left, top: Math.max(margin, 16) };
    }
    const bottomClearance = 88;
    return {
      left,
      top: Math.max(margin, window.innerHeight - height - bottomClearance),
    };
  }

  function clampPos(next: Pos): Pos {
    if (!browser) return next;
    const margin = 8;
    const width = cardEl?.offsetWidth ?? 216;
    const height = cardEl?.offsetHeight ?? 140;
    const maxLeft = Math.max(margin, window.innerWidth - width - margin);
    const maxTop = Math.max(margin, window.innerHeight - height - margin);
    return {
      left: Math.min(Math.max(next.left, margin), maxLeft),
      top: Math.min(Math.max(next.top, margin), maxTop),
    };
  }

  function readStoredPos(): Pos | null {
    const raw = readStored(storageKey);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<Pos>;
      if (typeof parsed.left !== "number" || typeof parsed.top !== "number") return null;
      return clampPos({ left: parsed.left, top: parsed.top });
    } catch {
      return null;
    }
  }

  $effect(() => {
    if (!browser || !cardEl) return;
    pos = readStoredPos() ?? defaultPos();

    const onResize = () => {
      if (!pos) return;
      pos = clampPos(pos);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  });

  function startDrag(event: PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (!cardEl) return;

    const current = pos ?? defaultPos();
    const grabOffsetX = event.clientX - current.left;
    const grabOffsetY = event.clientY - current.top;
    const pointerId = event.pointerId;

    event.preventDefault();
    dragging = true;

    try {
      cardEl.setPointerCapture(pointerId);
    } catch {
      // ignore
    }

    const onMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      pos = clampPos({
        left: moveEvent.clientX - grabOffsetX,
        top: moveEvent.clientY - grabOffsetY,
      });
    };

    const onEnd = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      dragging = false;
      try {
        if (cardEl?.hasPointerCapture(pointerId)) {
          cardEl.releasePointerCapture(pointerId);
        }
      } catch {
        // ignore
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      if (pos) writeStored(storageKey, JSON.stringify(pos));
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  }
</script>

<div
  bind:this={cardEl}
  class="fixed z-[60] {widthClass} rounded-xl border border-participant-orange/40 bg-card/95 shadow-lg backdrop-blur-sm {dragging
    ? 'cursor-grabbing'
    : ''}"
  class:invisible={!pos}
  style:left={pos ? `${pos.left}px` : "auto"}
  style:top={pos ? `${pos.top}px` : "auto"}
  role="group"
  aria-label={ariaLabel}
>
  <button
    type="button"
    class="flex w-full cursor-grab items-center gap-1.5 rounded-t-[0.7rem] border-b border-border/60 px-2.5 py-1.5 text-left active:cursor-grabbing"
    aria-label={`Drag ${title}`}
    onpointerdown={startDrag}
  >
    <GripVerticalIcon class="size-3.5 shrink-0 text-participant-orange" aria-hidden="true" />
    <span class="min-w-0 flex-1 truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
    <span class="shrink-0 text-[9px] uppercase tracking-wide text-muted-foreground/70">Drag</span>
  </button>
  <div class="p-2.5 pt-2">
    {@render children()}
  </div>
</div>
