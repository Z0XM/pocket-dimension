<script lang="ts">
  import type { LocalParticipant, RemoteParticipant } from "livekit-client";
  import { initialsForName } from "$lib/livekit/types";
  import { tileColorForParticipant, type ParticipantColor } from "$lib/participant-colors";

  type Props = {
    kind: "participant" | "screen-share" | "listening";
    participant: LocalParticipant | RemoteParticipant;
    displayName: string;
    localIdentity: string;
    localTileColor?: ParticipantColor | null;
    audioOnly?: boolean;
  };

  const { kind, participant, displayName, localIdentity, localTileColor, audioOnly = false }: Props = $props();

  const tileColor = $derived(
    tileColorForParticipant(participant.identity, {
      localIdentity,
      preferredColor: localTileColor,
    })
  );

  const label = $derived(kind === "listening" ? "Listen" : kind === "screen-share" ? (audioOnly ? "Audio" : "Screen") : initialsForName(displayName));
  const footer = $derived(kind === "listening" ? "Listening" : kind === "screen-share" ? (audioOnly ? "Audio" : "Screen") : displayName);
</script>

<div class="relative h-10 w-16 overflow-hidden rounded-md border border-border bg-secondary shadow-sm">
  <div class="flex size-full items-center justify-center" style="background-color: {tileColor}">
    <span class="text-xs font-semibold text-primary-foreground/90">{label}</span>
  </div>

  <div class="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-[9px] font-medium text-white">
    {footer}
  </div>
</div>
