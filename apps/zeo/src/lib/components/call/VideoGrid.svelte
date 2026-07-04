<script lang="ts">
  import type { Room } from "livekit-client";
  import { gridClassForCount } from "$lib/livekit/types";
  import { listRoomParticipants } from "$lib/livekit/room-client";
  import { tileColorForParticipant, type ParticipantColor } from "$lib/participant-colors";
  import ParticipantTile from "./ParticipantTile.svelte";

  type Props = {
    room: Room;
    activeSpeakerIdentity: string | null;
    audioLevels: Record<string, number>;
    localDisplayName: string;
    localMicEnabled?: boolean;
    localTileColor?: ParticipantColor | null;
  };

  const { room, activeSpeakerIdentity, audioLevels, localDisplayName, localMicEnabled, localTileColor }: Props = $props();

  const participants = $derived(listRoomParticipants(room));

  const displayNameFor = (identity: string, name?: string) => {
    if (identity === room.localParticipant.identity) return localDisplayName;
    return name || "Participant";
  };
</script>

<div class="grid h-full w-full gap-2 p-2 sm:gap-3 sm:p-4 {gridClassForCount(participants.length)}">
  {#each participants as participant (participant.identity)}
    <ParticipantTile
      {participant}
      displayName={displayNameFor(participant.identity, participant.name)}
      isActiveSpeaker={activeSpeakerIdentity === participant.identity}
      audioLevel={audioLevels[participant.identity] ?? 0}
      tileColor={tileColorForParticipant(participant.identity, {
        localIdentity: room.localParticipant.identity,
        preferredColor: localTileColor,
      })}
      isGuest={participant.identity.startsWith("guest_")}
      isLocal={participant.identity === room.localParticipant.identity}
      localMicEnabled={participant.identity === room.localParticipant.identity ? localMicEnabled : undefined}
    />
  {/each}
</div>
