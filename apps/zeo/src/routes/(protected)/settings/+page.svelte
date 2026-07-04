<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import TileColorPicker from "$lib/components/call/TileColorPicker.svelte";
  import { readStored, STORAGE_KEYS, writeStored } from "$lib/browser-storage";
  import { PARTICIPANT_COLORS, resolveParticipantColor, type ParticipantColor } from "$lib/participant-colors";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  let tileColor = $state<ParticipantColor>(PARTICIPANT_COLORS[0]);

  onMount(() => {
    if (!browser) return;
    const stored = readStored(STORAGE_KEYS.tileColor);
    if (stored) {
      const resolved = resolveParticipantColor(stored);
      if (resolved) tileColor = resolved;
    }
  });

  function setTileColor(color: ParticipantColor) {
    tileColor = color;
    writeStored(STORAGE_KEYS.tileColor, color);
  }
</script>

<svelte:head>
  <title>Settings — zeo</title>
</svelte:head>

<header class="mb-8 space-y-2">
  <h1 class="text-2xl font-semibold text-foreground">Settings</h1>
  <Button href="/" variant="link" class="h-auto p-0 text-sm">← Back to home</Button>
</header>

<main class="flex max-w-lg flex-col gap-5">
  <Card>
    <CardHeader class="pb-3">
      <CardTitle>Account</CardTitle>
      <CardDescription>Signed in as {data.user?.email}</CardDescription>
    </CardHeader>
    <CardContent class="pt-0">
      <p class="text-sm text-muted-foreground">
        {data.roomStats.activeRoomCount} of {data.roomStats.maxConcurrentRooms} rooms in use
      </p>
    </CardContent>
  </Card>

  <Card>
    <CardHeader class="pb-3">
      <CardTitle>Call appearance</CardTitle>
      <CardDescription>Choose the color shown on your tile when the camera is off.</CardDescription>
    </CardHeader>
    <CardContent class="pt-0">
      <TileColorPicker value={tileColor} onChange={setTileColor} />
    </CardContent>
  </Card>

  {#if data.isAdmin}
    <Card>
      <CardHeader class="pb-3">
        <CardTitle>Operator</CardTitle>
        <CardDescription>Manage global limits and active rooms.</CardDescription>
      </CardHeader>
      <CardContent class="pt-0">
        <Button href="/admin" variant="secondary">Open admin dashboard</Button>
      </CardContent>
    </Card>
  {/if}
</main>
