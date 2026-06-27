<script lang="ts">
  import icon from "$lib/assets/icon.svg";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import type { PageData } from "./$types";
  import { goto } from "$app/navigation";

  const { data }: { data: PageData } = $props();

  let roomName = $state("");
  let joinSlug = $state("");
  let waitingRoomEnabled = $state(false);
  let creating = $state(false);
  let errorMessage = $state<string | null>(null);

  const userCanCreate = $derived(data.roomStats.canCreate);

  async function createRoom() {
    errorMessage = null;
    creating = true;
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: roomName.trim(), waitingRoomEnabled }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        errorMessage = payload.message ?? "Could not create room";
        return;
      }
      await goto(`/room/${payload.room.slug}`);
    } catch {
      errorMessage = "Could not create room";
    } finally {
      creating = false;
    }
  }

  function joinRoom() {
    const slug = joinSlug
      .trim()
      .replace(/^.*\/room\//, "")
      .split(/[/?#]/)[0];
    if (!slug) {
      errorMessage = "Enter a room link or slug";
      return;
    }
    goto(`/room/${slug}`);
  }
</script>

<svelte:head>
  <title>zeo — video calls</title>
</svelte:head>

<header class="mb-12 space-y-4">
  <div class="flex items-center gap-3">
    <img src={icon} alt="" class="size-10 rounded-xl" width="40" height="40" />
    <p class="font-mono text-xs uppercase tracking-[0.35em] text-muted-foreground">Pocket Dimension</p>
  </div>

  <div class="space-y-2">
    <h1 class="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">zeo</h1>
    <p class="max-w-xl text-base text-muted-foreground">Self-hosted group video calls with screen sharing.</p>
  </div>
</header>

<main class="flex-1 space-y-6">
  <div class="rounded-xl border border-border bg-card/60 px-6 py-6">
    <p class="text-sm text-muted-foreground">Signed in as</p>
    <p class="font-medium text-foreground">{data.user?.email}</p>
    <p class="mt-1 text-xs text-muted-foreground">
      {data.roomStats.activeRoomCount} of {data.roomStats.maxConcurrentRooms} rooms in use
    </p>
  </div>

  {#if errorMessage}
    <div class="auth-error">{errorMessage}</div>
  {/if}

  {#if userCanCreate}
    <section class="rounded-xl border border-border bg-card/60 px-6 py-6 space-y-4">
      <div>
        <h2 class="text-lg font-semibold text-foreground">New room</h2>
        <p class="text-sm text-muted-foreground">Start a call and share the link with your group.</p>
      </div>
      <div class="space-y-2">
        <Label for="room-name">Room name</Label>
        <Input id="room-name" bind:value={roomName} placeholder="Team standup" maxlength={80} />
      </div>
      <label class="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" bind:checked={waitingRoomEnabled} class="rounded border-border" />
        Enable waiting room (host admits guests before they join)
      </label>
      <Button disabled={creating || !roomName.trim()} onclick={createRoom}>
        {creating ? "Creating…" : "Create room"}
      </Button>
    </section>
  {:else}
    <section class="rounded-xl border border-border bg-card/60 px-6 py-6">
      <h2 class="text-lg font-semibold text-foreground">Join a room</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Room creation is limited to contributors and admins. Paste a room link to join an existing call.
      </p>
    </section>
  {/if}

  <section class="rounded-xl border border-border bg-card/60 px-6 py-6 space-y-4">
    <div>
      <h2 class="text-lg font-semibold text-foreground">Join with link</h2>
      <p class="text-sm text-muted-foreground">Paste a room URL or slug.</p>
    </div>
    <div class="space-y-2">
      <Label for="join-slug">Room link or slug</Label>
      <Input id="join-slug" bind:value={joinSlug} placeholder="abc123… or /room/abc123" />
    </div>
    <Button variant="secondary" onclick={joinRoom}>Go to room</Button>
  </section>
</main>
