<script lang="ts">
  import DiscordSinkPanel from "$lib/components/DiscordSinkPanel.svelte";
  import SessionPlayer from "$lib/components/SessionPlayer.svelte";
  import type { SessionSnapshot } from "$lib/server/sessions/types";
  import type { PageData } from "./$types";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { untrack } from "svelte";

  let { data }: { data: PageData } = $props();

  let snapshot = $state<SessionSnapshot>(data.snapshot as SessionSnapshot);
  let audioEl = $state<HTMLAudioElement | null>(null);
  let catalogue = $state(data.catalogue);
  let q = $state(data.catalogueQ);
  let scope = $state<"all" | "yours">(data.catalogueScope === "yours" ? "yours" : "all");
  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  let queueBusy = $state<string | null>(null);
  let queueError = $state<string | null>(null);
  let discordSinkActive = $state(false);

  /** Stable route id — do not read snapshot.session.id inside the SSE effect (that re-subscribes forever). */
  const sessionRouteId = $derived(page.params.id ?? "");
  const sessionLive = $derived(snapshot.session?.status === "live");
  const canManageGuests = $derived(Boolean(snapshot.me?.canManageGuests));

  $effect(() => {
    // Hydrate from SSR/load navigations only — untrack so we don't fight SSE updates
    const next = data.snapshot as SessionSnapshot;
    const nextCatalogue = data.catalogue;
    const nextQ = data.catalogueQ;
    const nextScope = data.catalogueScope === "yours" ? "yours" : "all";
    untrack(() => {
      snapshot = next;
      catalogue = nextCatalogue;
      q = nextQ;
      scope = nextScope;
    });
  });

  // Reset browser/Discord output coupling when navigating between sessions
  $effect(() => {
    void sessionRouteId;
    discordSinkActive = false;
  });

  // One EventSource per session route id while live. Must NOT depend on snapshot object identity —
  // the server sends an initial snapshot on connect; writing that used to re-run this effect → reconnect storm.
  $effect(() => {
    const id = sessionRouteId;
    if (!id) return;

    const live = untrack(() => snapshot.session?.status === "live");
    if (!live) return;

    const es = new EventSource(`/api/sessions/${id}/events`);
    const onSnapshot = (ev: MessageEvent) => {
      try {
        const next = JSON.parse(ev.data) as SessionSnapshot;
        snapshot = next;
        if (next.session?.status !== "live") {
          es.close();
        }
      } catch {
        // ignore malformed
      }
    };
    es.addEventListener("snapshot", onSnapshot);
    es.onerror = () => {
      // Browser auto-reconnects the same EventSource; do not open a second one here.
    };
    return () => {
      es.removeEventListener("snapshot", onSnapshot);
      es.close();
    };
  });

  async function refreshCatalogue() {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (scope === "yours") params.set("scope", "yours");
    const res = await fetch(`/api/catalogue?${params.toString()}`, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return;
    const body = (await res.json()) as { assets: typeof catalogue };
    catalogue = body.assets;
  }

  function onSearchInput() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => void refreshCatalogue(), 280);
  }

  async function enqueue(mediaAssetId: string) {
    if (!snapshot.session) return;
    queueBusy = mediaAssetId;
    queueError = null;
    try {
      const res = await fetch(`/api/sessions/${snapshot.session.id}/queue`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ mediaAssetId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Enqueue failed (${res.status})`);
      snapshot = body as SessionSnapshot;
    } catch (err) {
      queueError = err instanceof Error ? err.message : "Enqueue failed";
    } finally {
      queueBusy = null;
    }
  }
</script>

<audio bind:this={audioEl} preload="auto" class="hidden"></audio>

<section class="space-y-6">
  <div class="flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 class="text-3xl font-semibold tracking-tight">Session</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Catalogue queue · parallel play on every joined device ·
        <a class="text-signal hover:underline" href="/library">Library</a>
      </p>
    </div>
    {#if !sessionLive}
      <a href="/" class="auth-btn">Back home</a>
    {/if}
  </div>

  <SessionPlayer bind:snapshot bind:audioEl {discordSinkActive} />

  {#if sessionLive && sessionRouteId}
    {#key sessionRouteId}
      <DiscordSinkPanel sessionId={sessionRouteId} canManage={canManageGuests} bind:active={discordSinkActive} />
    {/key}
  {/if}

  {#if sessionLive}
    <div class="grid gap-6 lg:grid-cols-2">
      <div class="space-y-3">
        <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Queue</h2>
        <ul class="divide-y divide-border/50 rounded-lg border border-border/70 bg-card/30">
          {#if snapshot.queue.length === 0}
            <li class="px-4 py-8 text-center text-sm text-muted-foreground">Queue empty — add from catalogue.</li>
          {:else}
            {#each snapshot.queue as item}
              <li class={`px-4 py-3 ${item.id === snapshot.currentItem?.id ? "bg-signal/10" : ""}`}>
                <p class="truncate font-medium">{item.title}</p>
                <p class="font-mono text-[11px] text-muted-foreground">
                  {item.artists ?? "Unknown"} · added by {item.addedByDisplayName}
                </p>
              </li>
            {/each}
          {/if}
        </ul>

        <h2 class="pt-2 font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Members</h2>
        <ul class="flex flex-wrap gap-2">
          {#each snapshot.members as m}
            <li class="rounded-full border border-border px-3 py-1 font-mono text-[11px] text-muted-foreground">
              {m.displayName} · {m.role}
            </li>
          {/each}
        </ul>
      </div>

      <div class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Add from catalogue</h2>
          <div class="flex gap-1">
            <button
              type="button"
              class={`rounded px-2 py-1 font-mono text-[10px] ${scope === "all" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
              onclick={() => {
                scope = "all";
                void refreshCatalogue();
              }}>All</button
            >
            <button
              type="button"
              class={`rounded px-2 py-1 font-mono text-[10px] ${scope === "yours" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
              onclick={() => {
                scope = "yours";
                void refreshCatalogue();
              }}>Your library</button
            >
          </div>
        </div>
        <input
          class="auth-field"
          type="search"
          placeholder="Search catalogue…"
          bind:value={q}
          oninput={onSearchInput}
          autocomplete="off"
          disabled={!snapshot.me?.canAdd}
        />
        {#if queueError}
          <p class="auth-error">{queueError}</p>
        {/if}
        <ul class="max-h-96 divide-y divide-border/50 overflow-y-auto rounded-lg border border-border/70 bg-card/30">
          {#each catalogue as track}
            <li class="flex items-center justify-between gap-2 px-3 py-2">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">{track.title}</p>
                <p class="truncate font-mono text-[10px] text-muted-foreground">{track.artists ?? "Unknown"}</p>
              </div>
              <button
                type="button"
                class="shrink-0 rounded border border-signal/40 px-2 py-1 font-mono text-[10px] text-signal hover:bg-signal/10 disabled:opacity-40"
                disabled={!snapshot.me?.canAdd || !track.playable || queueBusy === track.id}
                onclick={() => void enqueue(track.id)}
              >
                {queueBusy === track.id ? "…" : "Add"}
              </button>
            </li>
          {:else}
            <li class="px-4 py-8 text-center text-sm text-muted-foreground">No tracks.</li>
          {/each}
        </ul>
      </div>
    </div>
  {:else}
    <p class="text-sm text-muted-foreground">
      This session is over.
      <button type="button" class="text-signal hover:underline" onclick={() => goto("/")}>Start another</button>
    </p>
  {/if}
</section>
