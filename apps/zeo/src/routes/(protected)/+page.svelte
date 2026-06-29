<script lang="ts">
  import icon from "$lib/assets/icon.svg";
  import VideoIcon from "@lucide/svelte/icons/video";
  import LinkIcon from "@lucide/svelte/icons/link";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Separator } from "$lib/components/ui/separator";
  import { SettingToggle } from "$lib/components/ui/setting-toggle";
  import type { PageData } from "./$types";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { readStored, STORAGE_KEYS, writeStored } from "$lib/browser-storage";

  const { data }: { data: PageData } = $props();

  let roomName = $state("");
  let joinSlug = $state("");
  let waitingRoomEnabled = $state(data.waitingRoomDefaultEnabled);
  let isPublic = $state(false);
  let isPerpetual = $state(false);
  let scheduleMode = $state(false);
  let scheduledStartAt = $state("");
  let creating = $state(false);
  let errorMessage = $state<string | null>(null);

  const userCanCreate = $derived(data.roomStats.canCreate);

  $effect(() => {
    if (isPerpetual && scheduleMode) {
      scheduleMode = false;
      scheduledStartAt = "";
    }
  });

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
        isPerpetual,
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

  function roomStatusLabel(status: string) {
    if (status === "active") return "Live";
    if (status === "stale") return "Idle";
    return "Open";
  }
</script>

<svelte:head>
  <title>zeo — video calls</title>
</svelte:head>

<header class="mb-10 space-y-3">
  <div class="flex items-center gap-3">
    <img src={icon} alt="" class="size-10 rounded-xl" width="40" height="40" />
    <p class="font-mono text-xs uppercase tracking-[0.35em] text-muted-foreground">zeo</p>
  </div>
  <p class="max-w-xl text-muted-foreground">Self-hosted group video calls with screen sharing.</p>
</header>

<main class="flex flex-1 flex-col gap-5">
  {#if errorMessage}
    <div class="auth-error">{errorMessage}</div>
  {/if}

  {#if data.publicRooms.length > 0}
    <Card>
      <CardHeader class="pb-3">
        <CardTitle>Public rooms</CardTitle>
        <CardDescription>Join without a room code.</CardDescription>
      </CardHeader>
      <CardContent class="pt-0">
        <div class="grid gap-2 sm:grid-cols-2">
          {#each data.publicRooms as room (room.slug)}
            <a
              href="/room/{room.slug}"
              class="group flex flex-col gap-1.5 rounded-lg border border-border bg-secondary/30 px-4 py-3 transition-colors hover:border-accent/40 hover:bg-secondary/60"
            >
              <div class="flex items-start justify-between gap-2">
                <span class="font-medium text-foreground group-hover:text-accent">{room.displayName}</span>
                <Badge variant={room.status === "active" ? "default" : "secondary"}>
                  {roomStatusLabel(room.status)}
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
      <CardHeader class="pb-3">
        <CardTitle>New room</CardTitle>
        <CardDescription>Create a call and share the room code.</CardDescription>
      </CardHeader>
      <CardContent class="space-y-5 pt-0">
        <div class="w-full max-w-xs space-y-2 sm:max-w-sm">
          <Label for="room-name">Room name</Label>
          <div class="relative">
            <VideoIcon class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="room-name" bind:value={roomName} class="pl-9" placeholder="Team standup" maxlength={80} />
          </div>
        </div>

        <div class="w-full max-w-xs rounded-lg border border-border px-3 sm:max-w-sm">
          <SettingToggle
            id="waiting-room"
            label="Require approval"
            tooltip="Guests wait in a lobby until the host lets them in."
            bind:checked={waitingRoomEnabled}
          />
          <Separator />
          <SettingToggle
            id="public-room"
            label="Public"
            tooltip="Show this room on the home page so anyone can join without a code."
            bind:checked={isPublic}
          />
          <Separator />
          <SettingToggle
            id="perpetual-room"
            label="Always open"
            tooltip="Keep the room until you or an admin closes it. When empty, it goes idle and can be rejoined later."
            bind:checked={isPerpetual}
          />
          {#if data.scheduledRoomsEnabled}
            <Separator />
            <SettingToggle
              id="schedule-room"
              label="Schedule"
              tooltip="Create a persistent link now that opens at a chosen time."
              bind:checked={scheduleMode}
              disabled={isPerpetual}
            />
          {/if}
        </div>

        {#if scheduleMode && !isPerpetual}
          <div class="w-full max-w-xs space-y-2 sm:max-w-sm">
            <Label for="scheduled-start">Opens at</Label>
            <Input id="scheduled-start" type="datetime-local" bind:value={scheduledStartAt} />
          </div>
        {/if}

        <Button disabled={creating || !roomName.trim() || (scheduleMode && !scheduledStartAt)} onclick={createRoom}>
          {creating ? "Creating…" : scheduleMode ? "Schedule room" : "Create room"}
        </Button>
      </CardContent>
    </Card>

    {#if data.scheduledRooms.length > 0}
      <Card>
        <CardHeader class="pb-3">
          <CardTitle>Scheduled</CardTitle>
        </CardHeader>
        <CardContent class="space-y-2 pt-0">
          {#each data.scheduledRooms as room (room.slug)}
            <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-sm">
              <div>
                <a href="/room/{room.slug}" class="font-medium text-primary hover:underline">{room.displayName}</a>
                <p class="text-xs text-muted-foreground">{new Date(room.scheduledStartAt).toLocaleString()}</p>
              </div>
              <code class="font-mono text-xs text-muted-foreground">{room.slug}</code>
            </div>
          {/each}
        </CardContent>
      </Card>
    {/if}
  {:else}
    <Card>
      <CardHeader class="pb-3">
        <CardTitle>Join a room</CardTitle>
        <CardDescription>Browse public rooms above or enter a room code below.</CardDescription>
      </CardHeader>
    </Card>
  {/if}

  <Card>
    <CardHeader class="pb-3">
      <CardTitle>Join with code</CardTitle>
      <CardDescription>Use a code like <code class="font-mono text-xs">calm-river</code> or paste a full link.</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4 pt-0">
      <div class="space-y-2">
        <Label for="join-slug">Room code</Label>
        <div class="relative">
          <LinkIcon class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id="join-slug" bind:value={joinSlug} class="pl-9" placeholder="calm-river" />
        </div>
      </div>
      <Button variant="secondary" onclick={joinRoom}>Go to room</Button>
    </CardContent>
  </Card>
</main>
