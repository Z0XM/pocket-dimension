<script lang="ts">
  import { animationsEnabled } from "$lib/theme-prefs";

  let {
    text,
    class: className = "",
    /** Optional secondary line style hook (e.g. muted artists). */
    title = undefined,
  }: {
    text: string;
    class?: string;
    title?: string;
  } = $props();

  let rootEl: HTMLDivElement | null = $state(null);
  let measureEl: HTMLSpanElement | null = $state(null);
  let overflowing = $state(false);
  let distance = $state(0);
  let durationSec = $state(9);

  function motionOk() {
    if (!animationsEnabled()) return false;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return true;
  }

  function measure() {
    const root = rootEl;
    const tip = measureEl;
    if (!root || !tip) {
      overflowing = false;
      distance = 0;
      return;
    }
    const overflow = tip.scrollWidth - root.clientWidth;
    if (overflow > 2 && motionOk()) {
      overflowing = true;
      distance = overflow;
      // ~40px/s of travel plus hold time baked into the keyframes.
      durationSec = Math.min(18, Math.max(7, 4 + overflow / 28));
    } else {
      overflowing = false;
      distance = 0;
    }
  }

  $effect(() => {
    // Re-measure when the label or layout changes.
    void text;
    const root = rootEl;
    const tip = measureEl;
    if (!root || !tip) return;

    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => measure()) : null;
    ro?.observe(root);
    ro?.observe(tip);
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", onResize);
    };
  });
</script>

<div bind:this={rootEl} class={`zap-marquee ${overflowing ? "is-active" : ""} ${className}`} title={title ?? text}>
  <span
    bind:this={measureEl}
    class="zap-marquee-text"
    class:is-scrolling={overflowing}
    style={overflowing ? `--zap-marquee-distance:${distance}px` : undefined}
  >
    {text}
  </span>
</div>
