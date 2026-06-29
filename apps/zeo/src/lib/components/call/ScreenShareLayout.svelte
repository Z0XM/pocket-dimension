<script lang="ts">
  import type { Room } from "livekit-client";
  import { displayNameForParticipant, findScreenShareParticipant } from "$lib/livekit/screen-share";
  import { listRoomParticipants } from "$lib/livekit/room-client";
  import { participantColorForIdentity } from "$lib/participant-colors";
  import ScreenShareVideo from "./ScreenShareVideo.svelte";
  import ParticipantTile from "./ParticipantTile.svelte";

  type Props = {
    room: Room;
    activeSpeakerIdentity: string | null;
    audioLevels: Record<string, number>;
    localDisplayName: string;
  };

  const { room, activeSpeakerIdentity, audioLevels, localDisplayName }: Props = $props();

  const sharer = $derived(findScreenShareParticipant(room));
  const sharerName = $derived(sharer ? displayNameForParticipant(sharer, room.localParticipant.identity, localDisplayName) : "");

  const filmstrip = $derived(listRoomParticipants(room));
</script>

{#if sharer}
  <div class="flex h-full flex-col">
    <div class="shrink-0 border-b border-border bg-card/90 px-4 py-2 text-center text-sm text-foreground" role="status">
      {sharerName} is sharing their screen
    </div>

    <div class="relative min-h-0 flex-1 p-2 sm:p-3">
      <ScreenShareVideo participant={sharer} isLocal={sharer.identity === room.localParticipant.identity} />
    </div>

    <div class="flex shrink-0 gap-2 overflow-x-auto border-t border-border p-2 sm:p-3">
      {#each filmstrip as participant (participant.identity)}
        <div class="w-36 shrink-0 sm:w-44">
          <ParticipantTile
            {participant}
            displayName={displayNameForParticipant(participant, room.localParticipant.identity, localDisplayName)}
            isActiveSpeaker={activeSpeakerIdentity === participant.identity}
            audioLevel={audioLevels[participant.identity] ?? 0}
            tileColor={participantColorForIdentity(participant.identity)}
            isGuest={participant.identity.startsWith("guest_")}
            isLocal={participant.identity === room.localParticipant.identity}
            compact
          />
        </div>
      {/each}
    </div>
  </div>
{/if}
