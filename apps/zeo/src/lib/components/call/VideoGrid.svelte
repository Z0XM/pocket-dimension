<script lang="ts">
  import type { Room } from "livekit-client";
  import { gridClassForCount } from "$lib/livekit/types";
  import { listRoomParticipants } from "$lib/livekit/room-client";
  import { participantColorForIdentity } from "$lib/participant-colors";
  import ParticipantTile from "./ParticipantTile.svelte";

  type Props = {
    room: Room;
    activeSpeakerIdentity: string | null;
    audioLevels: Record<string, number>;
    localDisplayName: string;
  };

  const { room, activeSpeakerIdentity, audioLevels, localDisplayName }: Props = $props();

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
      tileColor={participantColorForIdentity(participant.identity)}
      isGuest={participant.identity.startsWith("guest_")}
      isLocal={participant.identity === room.localParticipant.identity}
    />
  {/each}
</div>
