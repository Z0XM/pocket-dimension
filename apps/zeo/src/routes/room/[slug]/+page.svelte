<script lang="ts">
  import icon from "$lib/assets/icon.svg";
  import { participantColorForIdentity } from "$lib/participant-colors";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import type { PageData } from "./$types";
  import { onMount } from "svelte";

  const { data }: { data: PageData } = $props();

  let guestName = $state("");
  let statusMessage = $state<string | null>(null);
  let errorMessage = $state<string | null>(null);
  let joining = $state(false);
  let participantCount = $state(data.participantCount);
  let isFull = $state(data.isFull);
  let isEnded = $state(data.isEnded);
  let participants = $state<Array<{ identity: string; displayName: string | null; isGuest: boolean }>>([]);
  let removeTarget = $state<string | null>(null);
  let ending = $state(false);

  const guestStorageKey = `zeo-guest:${data.slug}`;

  async function refreshRoom() {
    const res = await fetch(`/api/rooms/${data.slug}`);
    if (!res.ok) return;
    const payload = await res.json();
    participantCount = payload.participantCount;
    isFull = payload.isFull;
    isEnded = payload.isEnded;
    if (payload.participants) {
      participants = payload.participants;
    }
  }

  onMount(() => {
    const interval = setInterval(refreshRoom, 5000);
    refreshRoom();
    return () => clearInterval(interval);
  });

  async function requestToken() {
    errorMessage = null;
    statusMessage = null;
    joining = true;

    try {
      const body: Record<string, string> = {};
      if (!data.user) {
        if (!guestName.trim()) {
          errorMessage = "Enter your display name to join";
          return;
        }
        body.guestName = guestName.trim();
        const stored = sessionStorage.getItem(guestStorageKey);
        if (stored) body.guestIdentity = stored;
      }

      const res = await fetch(`/api/rooms/${data.slug}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        errorMessage = payload.message ?? "Could not join room";
        return;
      }

      if (payload.identity?.startsWith("guest_")) {
        sessionStorage.setItem(guestStorageKey, payload.identity);
      }

      statusMessage = `Ready to connect as ${payload.displayName}. LiveKit client wiring arrives in Epic 4.`;
      participantCount = payload.participantCount;
      await refreshRoom();
    } catch {
      errorMessage = "Could not join room";
    } finally {
      joining = false;
    }
  }

  async function endRoom() {
    if (!confirm("End this room for everyone?")) return;
    ending = true;
    try {
      const res = await fetch(`/api/rooms/${data.slug}/end`, { method: "POST" });
      if (!res.ok) {
        errorMessage = "Could not end room";
        return;
      }
      isEnded = true;
      statusMessage = "Room ended.";
    } finally {
      ending = false;
    }
  }

  async function removeParticipant(identity: string) {
    removeTarget = identity;
    try {
      const res = await fetch(`/api/rooms/${data.slug}/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity }),
      });
      if (!res.ok) {
        errorMessage = "Could not remove participant";
        return;
      }
      await refreshRoom();
    } finally {
      removeTarget = null;
    }
  }
</script>

<svelte:head>
  <title>{data.room.displayName} — zeo</title>
</svelte:head>

<header class="mb-8 flex items-center gap-3">
  <img src={icon} alt="" class="size-9 rounded-lg" width="36" height="36" />
  <div>
    <p class="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">zeo room</p>
    <h1 class="text-2xl font-semibold text-foreground">{data.room.displayName}</h1>
  </div>
</header>

<main class="space-y-6">
  <div class="rounded-xl border border-border bg-card/60 px-6 py-5">
    <p class="text-sm text-muted-foreground">
      {participantCount} of {data.maxParticipants} joined
    </p>
    {#if isEnded}
      <p class="mt-2 text-sm text-foreground">This room has ended.</p>
    {:else if isFull}
      <p class="mt-2 text-sm text-destructive">Room is full</p>
    {/if}
  </div>

  {#if errorMessage}
    <div class="auth-error">{errorMessage}</div>
  {/if}

  {#if statusMessage}
    <div class="auth-notice">{statusMessage}</div>
  {/if}

  {#if !isEnded && !isFull}
    <section class="rounded-xl border border-border bg-card/60 px-6 py-6 space-y-4">
      <h2 class="text-lg font-semibold">Join call</h2>

      {#if data.user}
        <p class="text-sm text-muted-foreground">
          Joining as {data.user.username ?? data.user.email}
        </p>
      {:else}
        <div class="space-y-2">
          <Label for="guest-name">Your name</Label>
          <Input id="guest-name" bind:value={guestName} placeholder="Marco" maxlength={40} />
          <p class="text-xs text-muted-foreground">No account needed — guests can join with a display name.</p>
        </div>
      {/if}

      <Button disabled={joining} onclick={requestToken}>
        {joining ? "Joining…" : "Join call"}
      </Button>
    </section>
  {/if}

  {#if data.isHost && !isEnded && participants.length > 0}
    <section class="rounded-xl border border-border bg-card/60 px-6 py-6 space-y-4">
      <h2 class="text-lg font-semibold">People</h2>
      <ul class="space-y-2">
        {#each participants as participant (participant.identity)}
          {@const color = participantColorForIdentity(participant.identity)}
          <li class="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
            <div class="flex items-center gap-3 min-w-0">
              <span class="size-8 shrink-0 rounded-md" style="background-color: {color}" aria-hidden="true"></span>
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-foreground">
                  {participant.displayName ?? "Participant"}
                </p>
                {#if participant.isGuest}
                  <p class="text-xs text-muted-foreground">Guest</p>
                {/if}
              </div>
            </div>
            {#if participant.identity !== data.user?.id}
              <Button
                variant="destructive"
                size="sm"
                disabled={removeTarget === participant.identity}
                onclick={() => {
                  if (confirm(`Remove ${participant.displayName ?? "this participant"}?`)) {
                    removeParticipant(participant.identity);
                  }
                }}
              >
                Remove
              </Button>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if data.isHost && !isEnded}
    <section class="rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-6">
      <h2 class="text-lg font-semibold text-foreground">Host controls</h2>
      <p class="mt-1 text-sm text-muted-foreground">End the room for everyone and free capacity.</p>
      <Button variant="destructive" class="mt-4" disabled={ending} onclick={endRoom}>
        {ending ? "Ending…" : "End room"}
      </Button>
    </section>
  {/if}

  {#if !data.user}
    <p class="text-center text-sm text-muted-foreground">
      <a href="/login?redirect=/room/{data.slug}" class="text-primary underline-offset-2 hover:underline"> Sign in </a>
      for a persistent identity (optional).
    </p>
  {/if}
</main>
