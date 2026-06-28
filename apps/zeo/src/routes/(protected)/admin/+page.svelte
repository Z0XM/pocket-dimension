<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Separator } from "$lib/components/ui/separator";
  import { SettingToggle } from "$lib/components/ui/setting-toggle";
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
  <Button href="/" variant="link" class="h-auto p-0 text-sm">← Back to home</Button>
</header>

<main class="flex flex-col gap-5">
  <Card>
    <CardHeader class="pb-3">
      <CardTitle>Active rooms</CardTitle>
      <CardDescription>Live calls consuming capacity right now.</CardDescription>
    </CardHeader>
    <CardContent class="pt-0">
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
                    <p class="font-mono text-xs text-muted-foreground">{room.slug}</p>
                  </td>
                  <td class="py-3 pr-4">{room.hostName}</td>
                  <td class="py-3 pr-4">{room.participantCount}</td>
                  <td class="py-3 pr-4 capitalize">{room.status}</td>
                  <td class="py-3">
                    <Button variant="secondary" size="sm" disabled={forceEnding === room.slug} onclick={() => forceEnd(room.slug)}>
                      {forceEnding === room.slug ? "Ending…" : "Force end"}
                    </Button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </CardContent>
  </Card>

  <Card>
    <CardHeader class="pb-3">
      <CardTitle>Scheduled</CardTitle>
      <CardDescription>Pre-created links waiting for their start time.</CardDescription>
    </CardHeader>
    <CardContent class="pt-0">
      {#if data.scheduledRooms.length === 0}
        <p class="text-sm text-muted-foreground">No upcoming scheduled rooms.</p>
      {:else}
        <ul class="space-y-2">
          {#each data.scheduledRooms as room (room.slug)}
            <li class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5">
              <div>
                <a href="/room/{room.slug}" class="font-medium text-primary hover:underline">{room.displayName}</a>
                <p class="text-xs text-muted-foreground">{new Date(room.scheduledStartAt).toLocaleString()}</p>
              </div>
              <span class="font-mono text-xs text-muted-foreground">{room.slug}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </CardContent>
  </Card>

  <Card>
    <CardHeader class="pb-3">
      <CardTitle>Configuration</CardTitle>
      <CardDescription>Global limits and feature flags.</CardDescription>
    </CardHeader>
    <CardContent class="space-y-5 pt-0">
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

      <div class="rounded-lg border border-border px-4">
        <SettingToggle id="chat-enabled" label="Chat" tooltip="Allow in-room text chat during calls." bind:checked={settings.chatEnabled} />
        <Separator />
        <SettingToggle
          id="waiting-default"
          label="Require approval by default"
          tooltip="New rooms start with the waiting room enabled."
          bind:checked={settings.waitingRoomDefaultEnabled}
        />
        <Separator />
        <SettingToggle
          id="schedule-enabled"
          label="Scheduling"
          tooltip="Allow hosts to schedule rooms for a future start time."
          bind:checked={settings.scheduledRoomsEnabled}
        />
      </div>

      {#if settingsMessage}
        <p class="text-sm text-muted-foreground">{settingsMessage}</p>
      {/if}

      <Button disabled={savingSettings} onclick={saveSettings}>
        {savingSettings ? "Saving…" : "Save settings"}
      </Button>
    </CardContent>
  </Card>
</main>
