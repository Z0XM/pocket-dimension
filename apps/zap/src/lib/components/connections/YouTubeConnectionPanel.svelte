<script lang="ts">
  import ListVideoIcon from "@lucide/svelte/icons/list-video";
  import UnplugIcon from "@lucide/svelte/icons/unplug";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
  import ConnectedPlaylistsPanel from "$lib/components/connections/ConnectedPlaylistsPanel.svelte";
  import { toast } from "$lib/toast.svelte";

  let {
    oauthConfigured,
    linked,
    linkedAt = null,
    activity = [],
    connectHref,
  }: {
    oauthConfigured: boolean;
    linked: boolean;
    linkedAt?: string | null;
    activity?: Array<{ id: string; kind: string; summary: string; at: string }>;
    connectHref: string;
  } = $props();

  let busyId = $state<string | null>(null);
  let disconnectOpen = $state(false);

  function when(iso: string | null) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  async function disconnect() {
    disconnectOpen = false;
    busyId = "__disconnect__";
    try {
      const res = await fetch("/api/me/youtube-link", { method: "DELETE", credentials: "same-origin" });
      if (!res.ok) throw new Error("Disconnect failed");
      window.location.href = "/connections?tab=youtube";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Disconnect failed");
      busyId = null;
    }
  }
</script>

<div class="space-y-6">
  <div class="flex flex-wrap items-start justify-between gap-2">
    <div class="space-y-3 min-w-0 flex-1">
      <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Details</h2>
      {#if !oauthConfigured}
        <p class="text-sm text-muted-foreground">
          Set <span class="font-mono text-signal">GOOGLE_CLIENT_ID</span> and
          <span class="font-mono text-signal">GOOGLE_CLIENT_SECRET</span> to enable Connect YouTube.
        </p>
      {:else if !linked}
        <p class="flex items-center gap-2 text-sm text-muted-foreground">
          <ListVideoIcon class="size-4 shrink-0" aria-hidden="true" />
          Not connected
        </p>
        <a class="auth-btn inline-flex items-center gap-2" href={connectHref}>Connect YouTube</a>
      {:else}
        <p class="flex flex-wrap items-center gap-2 text-sm">
          <ListVideoIcon class="size-4 text-signal" aria-hidden="true" />
          Connected
          <span class="font-mono text-[11px] text-muted-foreground">since {when(linkedAt)}</span>
        </p>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 font-mono text-[11px] text-muted-foreground hover:text-destructive disabled:opacity-40"
          disabled={busyId !== null}
          onclick={() => (disconnectOpen = true)}
        >
          <UnplugIcon class="size-3.5" aria-hidden="true" />
          Disconnect
        </button>
      {/if}
    </div>
  </div>

  {#if linked}
    <ConnectedPlaylistsPanel linked={true} showHide={true} showFilters={true} />
  {/if}

  <div class="space-y-3">
    <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Activity</h2>
    {#if activity.length === 0}
      <p class="font-mono text-[11px] text-muted-foreground">No YouTube activity yet.</p>
    {:else}
      <ul class="zap-track-host">
        {#each activity as entry (entry.id)}
          <li class="px-3 py-2.5">
            <p class="text-sm text-foreground">{entry.summary}</p>
            <p class="mt-0.5 font-mono text-[10px] text-muted-foreground">{entry.kind} · {when(entry.at)}</p>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<ConfirmDialog bind:open={disconnectOpen} title="Disconnect YouTube?" confirmLabel="Disconnect" danger onconfirm={() => void disconnect()}>
  <p class="text-sm text-muted-foreground">Stops playlist listing and auto-sync. Catalogue tracks and Zap playlists already created stay in Zap.</p>
</ConfirmDialog>
