<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();
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
