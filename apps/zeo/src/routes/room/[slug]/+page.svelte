<script lang="ts">
  import icon from "$lib/assets/icon.svg";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import CallExperience from "$lib/components/call/CallExperience.svelte";
  import type { CallPhase } from "$lib/livekit/types";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  let callPhase = $state<CallPhase>(data.isEnded ? "ended" : "lobby");
  const showPageChrome = $derived(
    callPhase === "lobby" || callPhase === "waiting_admission" || callPhase === "ended" || callPhase === "disconnected"
  );
</script>

<svelte:head>
  <title>{data.room.displayName} — zeo</title>
</svelte:head>

{#if showPageChrome}
  <header class="mb-8">
    <a
      href="/"
      class="group flex w-fit max-w-full items-center gap-3 rounded-lg px-2 py-1 -ml-2 transition-colors outline-none hover:bg-secondary/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      aria-label="Back to home"
    >
      <ChevronLeftIcon class="size-6 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden="true" />
      <img src={icon} alt="" class="size-9" width="36" height="36" />
      <div class="min-w-0">
        <p class="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">zeo room</p>
        <h1 class="truncate text-2xl font-semibold text-foreground">{data.room.displayName}</h1>
      </div>
    </a>
  </header>
{/if}

<CallExperience
  onPhaseChange={(p) => (callPhase = p)}
  slug={data.slug}
  roomTitle={data.room.displayName}
  hostName={data.hostName}
  maxParticipants={data.maxParticipants}
  isHost={data.isHost}
  hostUserId={data.room.hostUserId}
  initialIsPublic={data.room.isPublic}
  initialIsLocked={data.room.isLocked}
  initialIsStale={data.isStale}
  user={data.user}
  initialParticipantCount={data.participantCount}
  initialIsFull={data.isFull}
  initialIsEnded={data.isEnded}
  initialWaitingRoomEnabled={data.room.waitingRoomEnabled}
  initialIsScheduledForFuture={data.isScheduledForFuture}
  initialScheduledStartLabel={data.scheduledStartLabel}
  initialIsJoinable={data.isJoinable}
  chatEnabled={data.chatEnabled}
/>
