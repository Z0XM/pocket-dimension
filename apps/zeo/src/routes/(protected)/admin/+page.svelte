<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();

  let settings = $state({ ...data.settings });
  let savingSettings = $state(false);
  let settingsMessage = $state<string | null>(null);
  let forceEnding = $state<string | null>(null);

  async function saveSettings() {
    savingSettings = true;
    settingsMessage = null;
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        settingsMessage = payload.message ?? "Could not save settings";
        return;
      }
      settings = payload.settings;
      settingsMessage = "Settings saved";
    } finally {
      savingSettings = false;
    }
  }

  async function forceEnd(slug: string) {
    if (!confirm(`Force-end room ${slug}?`)) return;
    forceEnding = slug;
    try {
      const res = await fetch(`/api/admin/rooms/${slug}/force-end`, { method: "POST" });
      if (!res.ok) return;
      location.reload();
    } finally {
      forceEnding = null;
    }
  }
</script>

<svelte:head>
  <title>Admin — zeo</title>
</svelte:head>

<header class="mb-8 space-y-2">
  <p class="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">Operator dashboard</p>
  <h1 class="text-3xl font-semibold text-foreground">zeo admin</h1>
  <p class="text-sm text-muted-foreground">
    <a href="/" class="text-primary underline-offset-2 hover:underline">Back to home</a>
  </p>
</header>

<main class="space-y-8">
  <section class="rounded-xl border border-border bg-card/60 px-6 py-6 space-y-4">
    <div>
      <h2 class="text-lg font-semibold text-foreground">Active rooms</h2>
      <p class="text-sm text-muted-foreground">Live calls consuming capacity right now.</p>
    </div>

    {#if data.activeRooms.length === 0}
      <p class="text-sm text-muted-foreground">No active rooms.</p>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full min-w-[640px] text-left text-sm">
          <thead class="text-muted-foreground">
            <tr>
              <th class="pb-2 pr-4 font-medium">Room</th>
              <th class="pb-2 pr-4 font-medium">Host</th>
              <th class="pb-2 pr-4 font-medium">Participants</th>
              <th class="pb-2 pr-4 font-medium">Status</th>
              <th class="pb-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each data.activeRooms as room (room.slug)}
              <tr class="border-t border-border">
                <td class="py-3 pr-4">
                  <a href="/room/{room.slug}" class="font-medium text-primary hover:underline">{room.displayName}</a>
                  <p class="text-xs text-muted-foreground">{room.slug}</p>
                </td>
                <td class="py-3 pr-4">{room.hostName}</td>
                <td class="py-3 pr-4">{room.participantCount}</td>
                <td class="py-3 pr-4 capitalize">{room.status}</td>
                <td class="py-3">
                  <Button variant="secondary" disabled={forceEnding === room.slug} onclick={() => forceEnd(room.slug)}>
                    {forceEnding === room.slug ? "Ending…" : "Force end"}
                  </Button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>

  <section class="rounded-xl border border-border bg-card/60 px-6 py-6 space-y-4">
    <div>
      <h2 class="text-lg font-semibold text-foreground">Upcoming scheduled rooms</h2>
      <p class="text-sm text-muted-foreground">Pre-created links waiting for their start time.</p>
    </div>

    {#if data.scheduledRooms.length === 0}
      <p class="text-sm text-muted-foreground">No upcoming scheduled rooms.</p>
    {:else}
      <ul class="space-y-2">
        {#each data.scheduledRooms as room (room.slug)}
          <li class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
            <div>
              <a href="/room/{room.slug}" class="font-medium text-primary hover:underline">{room.displayName}</a>
              <p class="text-xs text-muted-foreground">{new Date(room.scheduledStartAt).toLocaleString()}</p>
            </div>
            <span class="text-xs text-muted-foreground">{room.slug}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="rounded-xl border border-border bg-card/60 px-6 py-6 space-y-4">
    <div>
      <h2 class="text-lg font-semibold text-foreground">Operator configuration</h2>
      <p class="text-sm text-muted-foreground">Global limits and feature flags (FR-44).</p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2">
      <div class="space-y-2">
        <Label for="max-rooms">Max concurrent rooms</Label>
        <Input id="max-rooms" type="number" min="1" max="20" bind:value={settings.maxConcurrentRooms} />
      </div>
      <div class="space-y-2">
        <Label for="max-participants">Max participants per room</Label>
        <Input id="max-participants" type="number" min="2" max="50" bind:value={settings.maxParticipantsPerRoom} />
      </div>
    </div>

    <div class="space-y-3">
      <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" bind:checked={settings.chatEnabled} class="rounded border-border" />
        Enable in-room chat
      </label>
      <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" bind:checked={settings.waitingRoomDefaultEnabled} class="rounded border-border" />
        Waiting room enabled by default for new rooms
      </label>
      <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" bind:checked={settings.scheduledRoomsEnabled} class="rounded border-border" />
        Allow scheduled rooms
      </label>
    </div>

    {#if settingsMessage}
      <p class="text-sm text-muted-foreground">{settingsMessage}</p>
    {/if}

    <Button disabled={savingSettings} onclick={saveSettings}>
      {savingSettings ? "Saving…" : "Save settings"}
    </Button>
  </section>
</main>
