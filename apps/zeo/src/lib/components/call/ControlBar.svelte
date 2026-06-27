<script lang="ts">
  type Props = {
    isHost: boolean;
    micEnabled: boolean;
    camEnabled: boolean;
    onToggleMic: () => void;
    onToggleCam: () => void;
    onLeave: () => void;
    onEndRoom?: () => void;
    ending?: boolean;
  };

  let { isHost, micEnabled, camEnabled, onToggleMic, onToggleCam, onLeave, onEndRoom, ending = false }: Props = $props();

  const micLabel = $derived(micEnabled ? "Mute microphone" : "Unmute microphone");
  const camLabel = $derived(camEnabled ? "Turn camera off" : "Turn camera on");
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      onToggleMic();
    }
    if (e.key === "v" || e.key === "V") {
      e.preventDefault();
      onToggleCam();
    }
  }}
/>

<div class="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-4 pb-6" aria-live="polite">
  <div
    class="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur-sm"
  >
    <button
      type="button"
      class="rounded-full border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={micLabel}
      aria-pressed={micEnabled}
      onclick={onToggleMic}
    >
      {micEnabled ? "Mic" : "Muted"}
    </button>
    <button
      type="button"
      class="rounded-full border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={camLabel}
      aria-pressed={camEnabled}
      onclick={onToggleCam}
    >
      {camEnabled ? "Camera" : "Camera off"}
    </button>
    <button
      type="button"
      class="rounded-full bg-destructive px-5 py-2.5 text-sm font-medium text-white hover:bg-destructive/90 focus-visible:ring-2 focus-visible:ring-destructive"
      aria-label="Leave call"
      onclick={onLeave}
    >
      Leave
    </button>
    {#if isHost && onEndRoom}
      <button
        type="button"
        class="rounded-full border border-destructive/50 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
        disabled={ending}
        onclick={onEndRoom}
      >
        {ending ? "Ending…" : "End room"}
      </button>
    {/if}
  </div>
</div>
