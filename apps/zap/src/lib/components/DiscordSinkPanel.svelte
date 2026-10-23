<script lang="ts">
  import HeadphonesIcon from "@lucide/svelte/icons/headphones";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import UnplugIcon from "@lucide/svelte/icons/unplug";
  import ZapSelect from "$lib/components/ZapSelect.svelte";

  let {
    sessionId,
    canManage = false,
    active = $bindable(false),
    /** `full` = setup attach/detach UI; `banner` = compact presence + reconnect on the session surface. */
    variant = "full",
  }: {
    sessionId: string;
    canManage?: boolean;
    /** True while a Discord sink is attached (pending/active/error until detached). */
    active?: boolean;
    variant?: "full" | "banner";
  } = $props();

  type SinkState = {
    id: string;
    status: string;
    guildId: string | null;
    channelId: string | null;
    guildName: string | null;
    channelName: string | null;
    errorMessage: string | null;
    voiceConnected: boolean;
  };

  let configured = $state(false);
  let inviteUrl = $state<string | null>(null);
  let sink = $state<SinkState | null>(null);

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

  const channelLabel = $derived(sink?.channelName ?? sink?.channelId ?? "voice");
  const needsReconnect = $derived(Boolean(sink && sink.status !== "detached" && !sink.voiceConnected));

  async function refresh(signal?: AbortSignal) {
    const res = await fetch(`/api/sessions/${sessionId}/discord`, {
      credentials: "same-origin",
      signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.message ?? `Status ${res.status}`);
    configured = Boolean(body.configured);
    inviteUrl = body.inviteUrl ?? null;
    const next = body.sink ?? null;
    sink = next
      ? {
          id: next.id,
          status: next.status,
          guildId: next.guildId ?? null,
          channelId: next.channelId ?? null,
          guildName: next.guildName ?? null,
          channelName: next.channelName ?? null,
          errorMessage: next.errorMessage ?? null,
          voiceConnected: Boolean(next.voiceConnected),
        }
      : null;
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
      await refresh();
    } catch (err) {
      error = err instanceof Error ? err.message : "Attach failed";
    } finally {
      busy = false;
    }
  }

  async function reconnect() {
    busy = true;
    error = null;
    try {
      const res = await fetch(`/api/sessions/${sessionId}/discord`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action: "reconnect" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Reconnect failed (${res.status})`);
      await refresh();
    } catch (err) {
      error = err instanceof Error ? err.message : "Reconnect failed";
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

  // Status fetch per session mount + light poll so kick/idle shows up without a full reload.
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

    const poll = setInterval(() => {
      if (ac.signal.aborted) return;
      void refresh(ac.signal).catch(() => {
        // keep last known state on transient poll failures
      });
    }, 15_000);

    return () => {
      ac.abort();
      clearInterval(poll);
    };
  });
</script>

{#if variant === "banner"}
  {#if loaded && sink && sink.status !== "detached"}
    <div
      class={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 ${
        sink.voiceConnected ? "border-signal/40 bg-signal/5" : "border-border/70 bg-card"
      }`}
      role="status"
    >
      {#if sink.voiceConnected}
        <HeadphonesIcon class="size-3.5 shrink-0 text-signal" aria-hidden="true" />
      {:else}
        <UnplugIcon class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      {/if}
      <p class="min-w-0 flex-1 font-mono text-[11px] text-muted-foreground">
        {#if sink.voiceConnected}
          Bot in <span class="text-signal">{channelLabel}</span>
        {:else}
          Bot not in <span class="text-foreground">{channelLabel}</span>
          {#if sink.errorMessage}
            <span class="text-muted-foreground"> — {sink.errorMessage}</span>
          {/if}
        {/if}
      </p>
      {#if canManage && needsReconnect}
        <button
          type="button"
          class="auth-btn inline-flex items-center gap-1.5 !px-2.5 !py-1"
          disabled={busy}
          onclick={() => void reconnect()}
        >
          <RefreshCwIcon class={`size-3.5 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
          {busy ? "Reconnecting…" : "Reconnect"}
        </button>
      {/if}
      {#if error}
        <p class="basis-full auth-error !mt-0">{error}</p>
      {/if}
    </div>
  {/if}
{:else if loaded}
  <div class="space-y-3 rounded-lg border border-border/70 bg-card p-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Discord sink</h2>
      <div class="flex items-center gap-2">
        {#if sink}
          <span class="inline-flex items-center gap-1.5 font-mono text-[10px] text-signal">
            {#if sink.voiceConnected}
              <HeadphonesIcon class="size-3" aria-hidden="true" />
              connected
            {:else}
              <UnplugIcon class="size-3" aria-hidden="true" />
              disconnected
            {/if}
            <span class="text-muted-foreground"
              >· {sink.guildName ?? sink.guildId} / {sink.channelName ?? sink.channelId}</span
            >
          </span>
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
        {#if sink && sink.voiceConnected}
          Bot is in {channelLabel} — host controls playback in Zap.
        {:else if sink}
          Bot is not in {channelLabel}. Ask someone with setup permission to reconnect.
        {:else}
          Host can attach Discord as an output sink.
        {/if}
      </p>
    {:else if sink && sink.status !== "detached"}
      {#if sink.errorMessage && !sink.voiceConnected}
        <p class="auth-error">{sink.errorMessage}</p>
      {:else if sink.errorMessage}
        <p class="auth-error">{sink.errorMessage}</p>
      {/if}
      {#if needsReconnect}
        <div class="flex flex-wrap items-center gap-2">
          <p class="font-mono text-[11px] text-muted-foreground">Bot left the selected channel. Reconnect to resume Discord audio.</p>
          <button
            type="button"
            class="auth-btn inline-flex items-center gap-1.5"
            disabled={busy}
            onclick={() => void reconnect()}
          >
            <RefreshCwIcon class={`size-3.5 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
            {busy ? "Reconnecting…" : "Reconnect"}
          </button>
        </div>
      {:else}
        <p class="font-mono text-[11px] text-muted-foreground">
          Audio goes to Discord. This browser is muted by default — enable “This browser” under Outputs to monitor locally.
        </p>
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
{:else if variant === "full"}
  <div class="rounded-lg border border-border/70 bg-card px-4 py-3 font-mono text-[11px] text-muted-foreground">Loading Discord sink…</div>
{/if}
