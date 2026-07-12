<script lang="ts">
  import Volume2Icon from "@lucide/svelte/icons/volume-2";
  import type { LocalParticipant, RemoteParticipant } from "livekit-client";
  import ScreenShareVideo from "./ScreenShareVideo.svelte";

  type Props = {
    participant: LocalParticipant | RemoteParticipant;
    displayName: string;
    isLocal?: boolean;
    hidden?: boolean;
    audioOnly?: boolean;
  };

  const { participant, displayName, isLocal = false, hidden = false, audioOnly = false }: Props = $props();
</script>

<div class="relative size-full overflow-hidden rounded-lg">
  {#if hidden}
    <div class="flex size-full items-center justify-center bg-secondary">
      <span class="text-sm font-medium text-muted-foreground">{audioOnly ? "Audio hidden" : "Screen hidden"}</span>
    </div>
  {:else if audioOnly}
    <div class="flex size-full flex-col items-center justify-center gap-3 bg-secondary">
      <Volume2Icon class="size-10 text-muted-foreground/80" aria-hidden="true" />
      <p class="text-sm font-medium text-muted-foreground">Sharing tab audio</p>
    </div>
  {:else}
    <ScreenShareVideo {participant} {isLocal} />
  {/if}

  <div class="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
    <p class="truncate text-sm font-medium text-white">{displayName}'s {audioOnly ? "audio" : "screen"}</p>
  </div>
</div>
