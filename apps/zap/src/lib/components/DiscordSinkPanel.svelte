<script lang="ts">
  let {
    sessionId,
    canManage = false,
  }: {
    sessionId: string;
    canManage?: boolean;
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
  let guilds = $state<{ id: string; name: string }[]>([]);
  let channels = $state<{ id: string; name: string }[]>([]);
  let guildId = $state("");
  let channelId = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);
  let loaded = $state(false);

  async function refresh() {
    const res = await fetch(`/api/sessions/${sessionId}/discord`, { credentials: "same-origin" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.message ?? `Status ${res.status}`);
    configured = Boolean(body.configured);
    inviteUrl = body.inviteUrl ?? null;
    sink = body.sink ?? null;
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
    } catch (err) {
      error = err instanceof Error ? err.message : "Detach failed";
    } finally {
      busy = false;
    }
  }

  $effect(() => {
    void (async () => {
      try {
        await refresh();
      } catch (err) {
        error = err instanceof Error ? err.message : "Failed to load Discord status";
      } finally {
        loaded = true;
      }
    })();
  });
</script>

{#if loaded}
  <div class="space-y-3 rounded-lg border border-border/70 bg-card/30 p-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Discord sink</h2>
      {#if sink}
        <span class="font-mono text-[10px] text-signal">{sink.status} · {sink.guildName ?? sink.guildId} / {sink.channelName ?? sink.channelId}</span>
      {/if}
    </div>

    {#if !configured}
      <p class="text-sm text-muted-foreground">
        Set <span class="font-mono text-signal">DISCORD_BOT_TOKEN</span> and
        <span class="font-mono text-signal">DISCORD_CLIENT_ID</span> to attach a voice channel.
      </p>
    {:else if !canManage}
      <p class="font-mono text-[11px] text-muted-foreground">
        {sink ? `Bot is in ${sink.channelName ?? "voice"} — host controls playback in Zap.` : "Host can attach Discord as an output sink."}
      </p>
    {:else if sink && sink.status !== "detached"}
      {#if sink.errorMessage}
        <p class="auth-error">{sink.errorMessage}</p>
      {/if}
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
        <select class="auth-field" bind:value={guildId} onchange={(e) => void loadChannels((e.currentTarget as HTMLSelectElement).value)}>
          <option value="">Select server…</option>
          {#each guilds as g}
            <option value={g.id}>{g.name}</option>
          {/each}
        </select>
      {/if}
      {#if channels.length > 0}
        <select class="auth-field" bind:value={channelId}>
          <option value="">Select voice channel…</option>
          {#each channels as c}
            <option value={c.id}>{c.name}</option>
          {/each}
        </select>
        <button type="button" class="auth-btn" disabled={busy || !guildId || !channelId} onclick={() => void attach()}>
          {busy ? "Joining…" : "Attach"}
        </button>
      {/if}
    {/if}

    {#if error}
      <p class="auth-error">{error}</p>
    {/if}
  </div>
{/if}
