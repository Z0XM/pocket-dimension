<script lang="ts">
  import icon from "$lib/assets/icon.svg";
  import CallExperience from "$lib/components/call/CallExperience.svelte";
  import { Button } from "$lib/components/ui/button";
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
  <header class="mb-8 flex items-start justify-between gap-4">
    <div class="flex items-center gap-3">
      <img src={icon} alt="" class="size-9 rounded-lg" width="36" height="36" />
      <div>
        <p class="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">zeo room</p>
        <h1 class="text-2xl font-semibold text-foreground">{data.room.displayName}</h1>
      </div>
    </div>

    {#if callPhase === "lobby" || callPhase === "waiting_admission"}
      <Button href="/" variant="outline" size="sm" class="shrink-0">← Back</Button>
    {/if}
  </header>
{/if}

<CallExperience
  onPhaseChange={(p) => (callPhase = p)}
  slug={data.slug}
  roomTitle={data.room.displayName}
  hostName={data.hostName}
  maxParticipants={data.maxParticipants}
  isHost={data.isHost}
  initialIsPublic={data.room.isPublic}
  initialIsStale={data.isStale}
  user={data.user}
  initialParticipantCount={data.participantCount}
  initialIsFull={data.isFull}
  initialIsEnded={data.isEnded}
  initialWaitingRoomEnabled={data.room.waitingRoomEnabled}
  initialIsScheduledForFuture={data.isScheduledForFuture}
  initialScheduledStartLabel={data.scheduledStartLabel}
  initialIsJoinable={data.isJoinable}
/>

{#if !data.user && !data.isEnded && showPageChrome}
  <p class="mt-8 text-center text-sm text-muted-foreground">
    <a href="/login?redirect=/room/{data.slug}" class="text-primary underline-offset-2 hover:underline"> Sign in </a>
    for a persistent identity (optional).
  </p>
{/if}
