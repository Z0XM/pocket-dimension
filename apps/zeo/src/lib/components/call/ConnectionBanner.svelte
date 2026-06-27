<script lang="ts">
  import type { CallPhase } from "$lib/livekit/types";

  type Props = {
    phase: CallPhase;
    disconnectMessage?: string | null;
    onRejoin?: () => void;
  };

  const { phase, disconnectMessage = null, onRejoin }: Props = $props();
</script>

{#if phase === "reconnecting"}
  <div class="absolute inset-x-0 top-0 z-20 border-b border-border bg-card/95 px-4 py-2 text-center text-sm text-foreground" role="status">
    Reconnecting…
  </div>
{:else if phase === "disconnected"}
  <div class="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-background/95 px-6 text-center" role="alert">
    <p class="text-lg font-medium text-foreground">
      {disconnectMessage ?? "Connection lost"}
    </p>
    {#if onRejoin}
      <button type="button" class="auth-btn" onclick={onRejoin}> Rejoin call </button>
    {/if}
  </div>
{:else if phase === "ended"}
  <div class="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-background px-6 text-center" role="status">
    <p class="text-lg font-medium text-foreground">This room has ended</p>
    <a href="/" class="text-sm text-primary underline-offset-2 hover:underline">Back to home</a>
  </div>
{/if}
