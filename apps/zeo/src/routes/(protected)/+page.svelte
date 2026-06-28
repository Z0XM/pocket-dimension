<script lang="ts">
  import icon from "$lib/assets/icon.svg";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Separator } from "$lib/components/ui/separator";
  import type { PageData } from "./$types";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { readStored, STORAGE_KEYS, writeStored } from "$lib/browser-storage";

  const { data }: { data: PageData } = $props();

  let roomName = $state("");
  let joinSlug = $state("");
  let waitingRoomEnabled = $state(data.waitingRoomDefaultEnabled);
  let isPublic = $state(false);
  let scheduleMode = $state(false);
  let scheduledStartAt = $state("");
  let creating = $state(false);
  let errorMessage = $state<string | null>(null);

  const userCanCreate = $derived(data.roomStats.canCreate);

  onMount(() => {
    const storedRoomName = readStored(STORAGE_KEYS.lastRoomName);
    if (storedRoomName) {
      roomName = storedRoomName;
    }
  });

  async function createRoom() {
    errorMessage = null;
    creating = true;
    try {
      const body: Record<string, string | boolean> = {
        displayName: roomName.trim(),
        waitingRoomEnabled,
        isPublic,
      };

      if (scheduleMode && scheduledStartAt) {
        body.scheduledStartAt = new Date(scheduledStartAt).toISOString();
      }

      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        errorMessage = payload.message ?? "Could not create room";
        return;
      }
      writeStored(STORAGE_KEYS.lastRoomName, roomName);
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
      errorMessage = "Enter a room code or link";
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
  <Card>
    <CardHeader>
      <CardDescription>Signed in as</CardDescription>
      <CardTitle class="text-base font-medium">{data.user?.email}</CardTitle>
    </CardHeader>
    <CardContent class="space-y-2 pt-0">
      <p class="text-xs text-muted-foreground">
        {data.roomStats.activeRoomCount} of {data.roomStats.maxConcurrentRooms} rooms in use
      </p>
      {#if data.isAdmin}
        <p class="text-sm">
          <a href="/admin" class="text-primary underline-offset-2 hover:underline">Open admin dashboard</a>
        </p>
      {/if}
    </CardContent>
  </Card>

  {#if errorMessage}
    <div class="auth-error">{errorMessage}</div>
  {/if}

  {#if data.publicRooms.length > 0}
    <Card>
      <CardHeader>
        <CardTitle>Public rooms</CardTitle>
        <CardDescription>Join an open call without a room code.</CardDescription>
      </CardHeader>
      <CardContent class="pt-0">
        <div class="grid gap-2 sm:grid-cols-2">
          {#each data.publicRooms as room (room.slug)}
            <a
              href="/room/{room.slug}"
              class="group flex flex-col gap-1 rounded-lg border border-border bg-secondary/40 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-secondary/70"
            >
              <div class="flex items-start justify-between gap-2">
                <span class="font-medium text-foreground group-hover:text-primary">{room.displayName}</span>
                <Badge variant={room.status === "active" ? "default" : "secondary"}>
                  {room.status === "active" ? "Live" : "Open"}
                </Badge>
              </div>
              <p class="text-xs text-muted-foreground">Host: {room.hostName}</p>
              <code class="font-mono text-xs text-muted-foreground">{room.slug}</code>
            </a>
          {/each}
        </div>
      </CardContent>
    </Card>
  {/if}

  {#if userCanCreate}
    <Card>
      <CardHeader>
        <CardTitle>New room</CardTitle>
        <CardDescription>Start a call and share the room code with your group.</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4 pt-0">
        <div class="space-y-2">
          <Label for="room-name">Room name</Label>
          <Input id="room-name" bind:value={roomName} placeholder="Team standup" maxlength={80} />
        </div>

        <div class="space-y-3">
          <label class="flex items-start gap-3 text-sm text-foreground">
            <Checkbox bind:checked={waitingRoomEnabled} class="mt-0.5" />
            <span>Enable waiting room (host admits guests before they join)</span>
          </label>

          <label class="flex items-start gap-3 text-sm text-foreground">
            <Checkbox bind:checked={isPublic} class="mt-0.5" />
            <span>Make room public (visible on the home page for anyone to join)</span>
          </label>

          {#if data.scheduledRoomsEnabled}
            <label class="flex items-start gap-3 text-sm text-foreground">
              <Checkbox bind:checked={scheduleMode} class="mt-0.5" />
              <span>Schedule for later (persistent link available immediately)</span>
            </label>
            {#if scheduleMode}
              <div class="space-y-2 pl-7">
                <Label for="scheduled-start">Start time</Label>
                <Input id="scheduled-start" type="datetime-local" bind:value={scheduledStartAt} />
              </div>
            {/if}
          {/if}
        </div>

        <Button disabled={creating || !roomName.trim() || (scheduleMode && !scheduledStartAt)} onclick={createRoom}>
          {creating ? "Creating…" : scheduleMode ? "Schedule room" : "Create room"}
        </Button>
      </CardContent>
    </Card>

    {#if data.scheduledRooms.length > 0}
      <Card>
        <CardHeader>
          <CardTitle>Your scheduled rooms</CardTitle>
        </CardHeader>
        <CardContent class="pt-0">
          <ul class="space-y-2">
            {#each data.scheduledRooms as room (room.slug)}
              <li class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <div>
                  <a href="/room/{room.slug}" class="font-medium text-primary hover:underline">{room.displayName}</a>
                  <p class="text-xs text-muted-foreground">{new Date(room.scheduledStartAt).toLocaleString()}</p>
                </div>
                <code class="font-mono text-xs text-muted-foreground">{room.slug}</code>
              </li>
            {/each}
          </ul>
        </CardContent>
      </Card>
    {/if}
  {:else}
    <Card>
      <CardHeader>
        <CardTitle>Join a room</CardTitle>
        <CardDescription>
          Room creation is limited to contributors and admins. Browse public rooms above or paste a room code to join a private call.
        </CardDescription>
      </CardHeader>
    </Card>
  {/if}

  <Separator />

  <Card>
    <CardHeader>
      <CardTitle>Join with code</CardTitle>
      <CardDescription>Paste a room code like <code class="font-mono text-xs">calm-river</code> or a full room link.</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4 pt-0">
      <div class="space-y-2">
        <Label for="join-slug">Room code or link</Label>
        <Input id="join-slug" bind:value={joinSlug} placeholder="calm-river or /room/calm-river" />
      </div>
      <Button variant="secondary" onclick={joinRoom}>Go to room</Button>
    </CardContent>
  </Card>
</main>
