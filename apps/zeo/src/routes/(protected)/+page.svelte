<script lang="ts">
  import icon from "$lib/assets/icon.svg";
  import VideoIcon from "@lucide/svelte/icons/video";
  import LinkIcon from "@lucide/svelte/icons/link";
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
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

<header class="mb-10">
  <div class="flex items-center gap-3">
    <img src={icon} alt="" class="size-10" width="40" height="40" />
    <p class="font-mono text-base font-semibold uppercase tracking-[0.35em] text-foreground">zeo</p>
  </div>
</header>

<main class="flex flex-1 flex-col gap-5">
  {#if errorMessage}
    <div class="auth-error">{errorMessage}</div>
  {/if}

  {#if data.publicRooms.length > 0}
    <Card>
      <CardHeader class="pb-3">
        <CardTitle class="text-participant-purple">Public rooms</CardTitle>
      </CardHeader>
      <CardContent class="pt-0">
        <div class="grid gap-2 sm:grid-cols-2">
          {#each data.publicRooms as room (room.slug)}
            <a
              href="/room/{room.slug}"
              class="group flex flex-col gap-1.5 rounded-lg border border-border bg-secondary/30 px-4 py-3 transition-all hover:border-accent/40 hover:bg-secondary/60 hover:shadow-sm hover:shadow-accent/10"
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

  <Card>
    <CardContent class="grid gap-8 p-6 md:grid-cols-2 md:gap-0 md:divide-x md:divide-border">
      <section class="space-y-5 md:pr-8">
        <div>
          <p class="font-medium text-participant-green">Create room</p>
        </div>

        {#if !userCanCreate}
          <p class="text-sm text-muted-foreground">Only contributors can create rooms.</p>
        {/if}

        <div class="space-y-2">
          <Label for="room-name">Room name</Label>
          <div class="relative">
            <VideoIcon class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-participant-orange" />
            <Input id="room-name" bind:value={roomName} class="pl-9" placeholder="Team standup" maxlength={80} disabled={!userCanCreate} />
          </div>
        </div>

        <div class="rounded-lg border border-border px-3">
          <SettingToggle
            id="waiting-room"
            label="Require approval"
            tooltip="Participants wait in a lobby until the host lets them in."
            bind:checked={waitingRoomEnabled}
            disabled={!userCanCreate}
          />
          <Separator />
          <SettingToggle
            id="public-room"
            label="Public"
            tooltip="Show this room on the home page so anyone can join without a code."
            bind:checked={isPublic}
            disabled={!userCanCreate}
          />
          <Separator />
          <SettingToggle
            id="perpetual-room"
            label="Always open"
            tooltip="Keep the room until you or an admin closes it. When empty, it goes idle and can be rejoined later."
            bind:checked={isPerpetual}
            disabled={!userCanCreate}
          />
          {#if data.scheduledRoomsEnabled}
            <Separator />
            <SettingToggle
              id="schedule-room"
              label="Schedule"
              tooltip="Create a persistent link now that opens at a chosen time."
              bind:checked={scheduleMode}
              disabled={!userCanCreate || isPerpetual}
            />
          {/if}
        </div>

        {#if scheduleMode && !isPerpetual}
          <div class="space-y-2">
            <Label for="scheduled-start">Opens at</Label>
            <Input id="scheduled-start" type="datetime-local" bind:value={scheduledStartAt} disabled={!userCanCreate} />
          </div>
        {/if}

        <Button class="group" disabled={!userCanCreate || creating || !roomName.trim() || (scheduleMode && !scheduledStartAt)} onclick={createRoom}>
          {#if creating}
            Creating…
          {:else if scheduleMode}
            Schedule room
          {:else}
            Create and Preview
            <ArrowRightIcon class="text-participant-orange transition-transform duration-200 group-hover:translate-x-0.5" />
          {/if}
        </Button>
      </section>

      <section class="space-y-4 md:pl-8">
        <div>
          <p class="font-medium text-participant-blue">Join room</p>
          <p class="mt-1 text-sm text-muted-foreground">
            Use a code like <code class="font-mono text-xs">calm-river</code> or paste a full link.
          </p>
        </div>
        <div class="space-y-2">
          <Label for="join-slug">Room code</Label>
          <div class="relative">
            <LinkIcon class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-participant-orange" />
            <Input id="join-slug" bind:value={joinSlug} class="pl-9" placeholder="calm-river" />
          </div>
        </div>
        <Button variant="secondary" class="group" onclick={joinRoom}>
          Join and Preview
          <ArrowRightIcon class="text-participant-orange transition-transform duration-200 group-hover:translate-x-0.5" />
        </Button>
      </section>
    </CardContent>
  </Card>

  {#if userCanCreate && data.scheduledRooms.length > 0}
    <Card>
      <CardHeader class="pb-3">
        <CardTitle>Scheduled</CardTitle>
      </CardHeader>
      <CardContent class="space-y-2 pt-0">
        {#each data.scheduledRooms as room (room.slug)}
          <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-sm">
            <div>
              <a href="/room/{room.slug}" class="link-action font-medium">{room.displayName}</a>
              <p class="text-xs text-muted-foreground">{new Date(room.scheduledStartAt).toLocaleString()}</p>
            </div>
            <code class="font-mono text-xs text-muted-foreground">{room.slug}</code>
          </div>
        {/each}
      </CardContent>
    </Card>
  {/if}
</main>
