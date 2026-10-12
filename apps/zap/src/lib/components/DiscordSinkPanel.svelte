<script lang="ts">
  import ZapSelect from "$lib/components/ZapSelect.svelte";

  let {
    sessionId,
    canManage = false,
    active = $bindable(false),
  }: {
    sessionId: string;
    canManage?: boolean;
    /** True while a Discord sink is attached (pending/active/error until detached). */
    active?: boolean;
  } = $props();

  let configured = $state(false);
  let inviteUrl = $state<string | null>(null);
  let sink = $state<{
    id: string;
    status: string;
    guildId: string | null;
    channelId: string | null;
    guildName: string | null;
    channelName: string | null;
    errorMessage: string | null;
  } | null>(null);

  function syncActive() {
    active = Boolean(sink && sink.status !== "detached");
  }
  let guilds = $state<{ id: string; name: string }[]>([]);
  let channels = $state<{ id: string; name: string }[]>([]);
  let guildId = $state("");
  let channelId = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);
  let loaded = $state(false);

  async function refresh(signal?: AbortSignal) {
    const res = await fetch(`/api/sessions/${sessionId}/discord`, {
      credentials: "same-origin",
      signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.message ?? `Status ${res.status}`);
    configured = Boolean(body.configured);
    inviteUrl = body.inviteUrl ?? null;
    sink = body.sink ?? null;
    syncActive();
  }

  async function loadGuilds() {
    busy = true;
    error = null;
    try {
      const res = await fetch("/api/discord/guilds", { credentials: "same-origin" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Failed (${res.status})`);
      guilds = body.guilds ?? [];
      inviteUrl = body.inviteUrl ?? inviteUrl;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to list guilds";
    } finally {
      busy = false;
    }
  }

  async function loadChannels(id: string) {
    guildId = id;
    channelId = "";
    channels = [];
    if (!id) return;
    busy = true;
    error = null;
    try {
      const res = await fetch(`/api/discord/guilds/${id}/channels`, { credentials: "same-origin" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Failed (${res.status})`);
      channels = body.channels ?? [];
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to list channels";
    } finally {
      busy = false;
    }
  }

  async function attach() {
    if (!guildId || !channelId) return;
    busy = true;
    error = null;
    try {
      const res = await fetch(`/api/sessions/${sessionId}/discord`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ guildId, channelId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Attach failed (${res.status})`);
      sink = body.sink ?? null;
      syncActive();
    } catch (err) {
      error = err instanceof Error ? err.message : "Attach failed";
    } finally {
      busy = false;
    }
  }

  async function detach() {
    busy = true;
    error = null;
    try {
      const res = await fetch(`/api/sessions/${sessionId}/discord`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Detach failed (${res.status})`);
      sink = null;
      syncActive();
    } catch (err) {
      error = err instanceof Error ? err.message : "Detach failed";
    } finally {
      busy = false;
    }
  }

  // One status fetch per sessionId mount — not on every parent snapshot tick
  $effect(() => {
    const id = sessionId;
    if (!id) return;

    const ac = new AbortController();
    loaded = false;
    error = null;

    void (async () => {
      try {
        await refresh(ac.signal);
      } catch (err) {
        if (ac.signal.aborted) return;
        error = err instanceof Error ? err.message : "Failed to load Discord status";
      } finally {
        if (!ac.signal.aborted) loaded = true;
      }
    })();

    return () => ac.abort();
  });
</script>

{#if loaded}
  <div class="space-y-3 rounded-lg border border-border/70 bg-card/30 p-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Discord sink</h2>
      <div class="flex items-center gap-2">
        {#if sink}
          <span class="font-mono text-[10px] text-signal"
            >{sink.status} · {sink.guildName ?? sink.guildId} / {sink.channelName ?? sink.channelId}</span
          >
        {/if}
        {#if canManage}
          <button
            type="button"
            class="rounded border border-border px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-signal disabled:opacity-40"
            disabled={busy}
            onclick={() => {
              error = null;
              void refresh().catch((err) => {
                error = err instanceof Error ? err.message : "Refresh failed";
              });
            }}
          >
            Refresh
          </button>
        {/if}
      </div>
    </div>

    {#if !configured}
      <button type="button" class="auth-btn opacity-50" disabled title="Discord bot not configured">Attach Discord</button>
      <p class="text-sm text-muted-foreground">
        Set <span class="font-mono text-signal">DISCORD_BOT_TOKEN</span> and
        <span class="font-mono text-signal">DISCORD_CLIENT_ID</span> (or
        <span class="font-mono">DISCORD_APPLICATION_ID</span>) to enable. Attach from a live session after inviting the bot.
      </p>
    {:else if !canManage}
      <p class="font-mono text-[11px] text-muted-foreground">
        {sink ? `Bot is in ${sink.channelName ?? "voice"} — host controls playback in Zap.` : "Host can attach Discord as an output sink."}
      </p>
    {:else if sink && sink.status !== "detached"}
      {#if sink.errorMessage}
        <p class="auth-error">{sink.errorMessage}</p>
      {/if}
      <p class="font-mono text-[11px] text-muted-foreground">
        Audio goes to Discord. This browser is muted by default — enable “This browser” under Outputs to monitor locally.
      </p>
      <button type="button" class="rounded border border-border px-3 py-1.5 font-mono text-[11px]" disabled={busy} onclick={() => void detach()}>
        Detach Discord
      </button>
    {:else}
      <p class="text-sm text-muted-foreground">Invite the shared bot, then pick a voice channel. Playback stays controlled in Zap.</p>
      {#if inviteUrl}
        <a class="font-mono text-[11px] text-signal hover:underline" href={inviteUrl} target="_blank" rel="noreferrer">Invite bot to server</a>
      {/if}
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded border border-border px-3 py-1.5 font-mono text-[11px]"
          disabled={busy}
          onclick={() => void loadGuilds()}
        >
          Load servers
        </button>
      </div>
      {#if guilds.length > 0}
        <ZapSelect
          options={guilds.map((g) => ({ value: g.id, label: g.name }))}
          bind:value={guildId}
          placeholder="Select server…"
          disabled={busy}
          onChange={(id) => void loadChannels(id)}
        />
      {/if}
      {#if channels.length > 0}
        <ZapSelect
          options={channels.map((c) => ({ value: c.id, label: c.name }))}
          bind:value={channelId}
          placeholder="Select voice channel…"
          disabled={busy}
        />
        <button type="button" class="auth-btn" disabled={busy || !guildId || !channelId} onclick={() => void attach()}>
          {busy ? "Joining…" : "Attach"}
        </button>
      {/if}
    {/if}

    {#if error}
      <p class="auth-error">{error}</p>
    {/if}
  </div>
{:else}
  <div class="rounded-lg border border-border/70 bg-card/30 px-4 py-3 font-mono text-[11px] text-muted-foreground">Loading Discord sink…</div>
{/if}
