<script lang="ts">
  import type { LocalParticipant, RemoteParticipant } from "livekit-client";
  import { initialsForName } from "$lib/livekit/types";
  import ScreenShareVideo from "./ScreenShareVideo.svelte";

  type Props = {
    participant: LocalParticipant | RemoteParticipant;
    displayName: string;
    isLocal?: boolean;
    hidden?: boolean;
  };

  const { participant, displayName, isLocal = false, hidden = false }: Props = $props();
</script>

<div class="relative size-full overflow-hidden rounded-lg">
  {#if hidden}
    <div class="flex size-full items-center justify-center bg-secondary">
      <span class="text-sm font-medium text-muted-foreground">Screen hidden</span>
    </div>
  {:else}
    <ScreenShareVideo {participant} {isLocal} />
  {/if}

  <div class="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
    <p class="truncate text-sm font-medium text-white">{displayName}'s screen</p>
  </div>
</div>
