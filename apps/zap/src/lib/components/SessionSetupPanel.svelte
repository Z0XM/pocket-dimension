<script lang="ts">
  import Volume2Icon from "@lucide/svelte/icons/volume-2";
  import VolumeXIcon from "@lucide/svelte/icons/volume-x";
  import DiscordSinkPanel from "$lib/components/DiscordSinkPanel.svelte";
  import type { SessionMemberPermissions, SessionSnapshot } from "$lib/server/sessions/types";

  let {
    snapshot = $bindable<SessionSnapshot>(),
    discordSinkActive = $bindable(false),
  }: {
    snapshot: SessionSnapshot;
    discordSinkActive?: boolean;
  } = $props();

  let busy = $state(false);
  let error = $state<string | null>(null);

  const session = $derived(snapshot.session);
  const canSetup = $derived(Boolean(snapshot.me?.canSetup));
  const isHost = $derived(snapshot.me?.role === "host");
  const sessionId = $derived(session?.id ?? "");

  const permKeys: { key: keyof SessionMemberPermissions; label: string }[] = [
    { key: "canAdd", label: "Add" },
    { key: "canPlayPause", label: "Play" },
    { key: "canSkip", label: "Skip" },
    { key: "canSeek", label: "Seek" },
    { key: "canReorder", label: "Queue" },
    { key: "canSetup", label: "Setup" },
  ];

  async function patch(body: Record<string, unknown>) {
    if (!session) return;
    busy = true;
    error = null;
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? "Update failed");
      snapshot = data as SessionSnapshot;
    } catch (err) {
      error = err instanceof Error ? err.message : "Update failed";
    } finally {
      busy = false;
    }
  }

  function togglePerm(userId: string, key: keyof SessionMemberPermissions, value: boolean) {
    void patch({ memberUserId: userId, permissions: { [key]: value } });
  }

  function setOutput(userId: string, patchBody: { outputEnabled?: boolean; volume?: number }) {
    void patch({ memberUserId: userId, ...patchBody });
  }
</script>

{#if !canSetup}
  <p class="text-sm text-muted-foreground">You don’t have setup permission for this session.</p>
{:else if session && session.status === "live"}
  <div class="space-y-6">
    <div class="space-y-3 rounded-lg border border-border/70 bg-card/30 p-4">
      <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Session options</h2>
      <div class="flex flex-wrap gap-4 font-mono text-[11px]">
        <label class="flex items-center gap-2" title="When the queue ends, pick another catalogue track">
          <input
            class="zap-checkbox"
            type="checkbox"
            checked={session.autoPlay}
            disabled={busy}
            onchange={(e) => void patch({ autoPlay: (e.currentTarget as HTMLInputElement).checked })}
          />
          Auto-play
        </label>
        {#if isHost}
          <label class="flex items-center gap-2" title="Keep this room when idle; rejoin anytime">
            <input
              class="zap-checkbox"
              type="checkbox"
              checked={session.perpetual}
              disabled={busy}
              onchange={(e) => void patch({ perpetual: (e.currentTarget as HTMLInputElement).checked })}
            />
            Perpetual
          </label>
        {/if}
      </div>
    </div>

    <div class="space-y-3">
      <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Discord sync</h2>
      {#key sessionId}
        <DiscordSinkPanel {sessionId} canManage={canSetup} bind:active={discordSinkActive} />
      {/key}
    </div>

    <div class="space-y-3">
      <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Member outputs</h2>
      <ul class="divide-y divide-border/50 rounded-lg border border-border/70 bg-card/30">
        {#each snapshot.members as m (m.id)}
          <li class="space-y-2 px-3 py-2.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">
                  {m.displayName}
                  <span class="font-mono text-[10px] text-muted-foreground">· {m.role}</span>
                </p>
              </div>
              <button
                type="button"
                class={`inline-flex h-7 items-center gap-1 rounded border px-2 font-mono text-[10px] ${
                  m.outputEnabled ? "border-signal/50 bg-signal/10 text-signal" : "border-border text-muted-foreground"
                }`}
                disabled={busy}
                aria-pressed={m.outputEnabled}
                title={m.outputEnabled ? "Mute output" : "Enable output"}
                onclick={() => setOutput(m.userId, { outputEnabled: !m.outputEnabled })}
              >
                {#if m.outputEnabled}<Volume2Icon class="size-3.5" /> On{:else}<VolumeXIcon class="size-3.5" /> Off{/if}
              </button>
            </div>
            {#if m.outputEnabled}
              <label class="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                Volume
                <input
                  class="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-[var(--signal)]"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={m.volume}
                  disabled={busy}
                  onchange={(e) => setOutput(m.userId, { volume: Number((e.currentTarget as HTMLInputElement).value) })}
                />
                <span class="w-7 text-right tabular-nums">{m.volume}</span>
              </label>
            {/if}
          </li>
        {/each}
      </ul>
    </div>

    <div class="space-y-3">
      <h2 class="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">Permissions</h2>
      <p class="text-xs text-muted-foreground">Host always has full access. Grant capabilities per joined user.</p>
      <div class="overflow-x-auto rounded-lg border border-border/70 bg-card/30">
        <table class="w-full min-w-[36rem] text-left font-mono text-[10px]">
          <thead>
            <tr class="border-b border-border/60 text-muted-foreground">
              <th class="px-3 py-2 font-medium">Member</th>
              {#each permKeys as col}
                <th class="px-2 py-2 text-center font-medium">{col.label}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each snapshot.members as m (m.id)}
              <tr class="border-b border-border/40 last:border-0">
                <td class="max-w-[10rem] truncate px-3 py-2 text-[11px] text-foreground">
                  {m.displayName}
                  <span class="text-muted-foreground">· {m.role}</span>
                </td>
                {#each permKeys as col}
                  <td class="px-2 py-2 text-center">
                    {#if m.role === "host"}
                      <span class="text-signal" title="Host always allowed">✓</span>
                    {:else if col.key === "canSetup" && !isHost}
                      <span class="text-muted-foreground" title="Only host can grant setup">—</span>
                    {:else}
                      <input
                        class="zap-checkbox"
                        type="checkbox"
                        checked={m.permissions[col.key]}
                        disabled={busy}
                        aria-label={`${col.label} for ${m.displayName}`}
                        onchange={(e) => togglePerm(m.userId, col.key, (e.currentTarget as HTMLInputElement).checked)}
                      />
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    {#if error}
      <p class="font-mono text-[11px] text-destructive">{error}</p>
    {/if}
  </div>
{/if}
