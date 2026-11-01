<script lang="ts">
  let {
    valueMs,
    durationMs,
    disabled = false,
    ariaLabel = "Seek",
    class: className = "h-1.5 w-full",
    onseek,
    onscrub,
  }: {
    valueMs: number;
    durationMs: number;
    disabled?: boolean;
    ariaLabel?: string;
    class?: string;
    onseek: (ms: number) => void;
    /** Fires while dragging / holding optimistic scrub (null when live value is shown). */
    onscrub?: (ms: number | null) => void;
  } = $props();

  /** Local scrub while dragging; held until live value catches up after commit. */
  let scrubMs = $state<number | null>(null);

  const maxSec = $derived(Math.max(durationMs / 1000, 1));
  const displayMs = $derived(scrubMs ?? valueMs);
  const pct = $derived(Math.min(100, Math.max(0, (displayMs / 1000 / maxSec) * 100)));

  function setScrub(ms: number | null) {
    scrubMs = ms;
    onscrub?.(ms);
  }

  $effect(() => {
    if (scrubMs == null) return;
    if (Math.abs(valueMs - scrubMs) < 500) setScrub(null);
  });

  function oninput(e: Event) {
    setScrub(Number((e.currentTarget as HTMLInputElement).value) * 1000);
  }

  function onchange(e: Event) {
    const ms = Number((e.currentTarget as HTMLInputElement).value) * 1000;
    if (!Number.isFinite(ms)) {
      setScrub(null);
      return;
    }
    setScrub(ms);
    onseek(ms);
  }
</script>

<input
  class={`zap-seek zap-seek--progress cursor-pointer appearance-none rounded-full disabled:opacity-40 ${className}`}
  style={`--seek-pct: ${pct}%`}
  type="range"
  min="0"
  max={maxSec}
  step="0.5"
  value={displayMs / 1000}
  {disabled}
  aria-label={ariaLabel}
  {oninput}
  {onchange}
/>
