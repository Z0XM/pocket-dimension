<script lang="ts">
  import PlayIcon from "@lucide/svelte/icons/play";
  import BusyStatus from "$lib/components/BusyStatus.svelte";
  import { toast } from "$lib/toast.svelte";

  let {
    label = "Start session",
    class: className = "inline-flex items-center gap-1.5 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40",
    /** When false, hide create/new — guests Join/Resume only. */
    allowStart = true,
    /** Show a perpetual toggle when starting a new session. */
    showPerpetualOption = false,
    /** Optional name field when creating a new session. */
    showNameOption = false,
    /** Prefill + default submit name (e.g. "{name}'s session"). */
    defaultName = "",
    /** Skip Resume — only create (sessions index start panel). */
    createOnly = false,
  }: {
    label?: string;
    class?: string;
    allowStart?: boolean;
    showPerpetualOption?: boolean;
    showNameOption?: boolean;
    defaultName?: string;
    createOnly?: boolean;
  } = $props();

  let busy = $state(false);
  let liveId = $state<string | null>(null);
  let liveTitle = $state<string | null>(null);
  let liveRole = $state<"host" | "guest" | null>(null);
  let canStart = $state(allowStart);
  let checked = $state(false);
  let perpetual = $state(false);
  let sessionName = $state(defaultName);

  $effect(() => {
    canStart = allowStart;
  });

  // Seed once when the server default arrives (avoid fighting user edits).
  $effect(() => {
    if (defaultName && sessionName === "") sessionName = defaultName;
  });

  $effect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/sessions", { credentials: "same-origin", headers: { Accept: "application/json" } });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as {
          sessionId?: string | null;
          live?: { id: string; role: "host" | "guest"; currentTitle: string | null }[];
        };
        const live = body.live ?? [];
        const host = live.find((s) => s.role === "host");
        const primary = host ?? (body.sessionId ? live.find((s) => s.id === body.sessionId) : null) ?? live[0] ?? null;
        if (!cancelled && primary) {
          liveId = primary.id;
          liveTitle = primary.currentTitle ?? null;
          liveRole = primary.role;
        }
        if (!cancelled) {
          // Guest-only live → no start, even if prop says true
          const guestOnly = live.length > 0 && !live.some((s) => s.role === "host");
          canStart = allowStart && !guestOnly;
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) checked = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  });

  async function goResume() {
    if (!liveId) return;
    window.location.href = `/session/${liveId}`;
  }

  async function start(forceNew = false) {
    if (!forceNew && liveId) {
      goResume();
      return;
    }
    if (!canStart) {
      toast.info("Guests can’t start sessions — join or resume instead.");
      return;
    }
    busy = true;
    try {
      const name = showNameOption ? sessionName.trim() || defaultName.trim() || undefined : undefined;
      const res = await fetch("/api/sessions", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          forceNew: true,
          perpetual: showPerpetualOption ? perpetual : false,
          ...(name ? { name } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Could not start session (${res.status})`);
      const id = body?.session?.id;
      if (!id) throw new Error("No session id returned");
      window.location.href = `/session/${id}`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start session");
      busy = false;
    }
  }
</script>

<span class="inline-flex w-full flex-col items-start gap-2">
  {#if createOnly}
    {#if canStart}
      <span class="flex w-full flex-wrap items-end gap-3">
        {#if showNameOption}
          <label class="flex min-w-[10rem] flex-1 flex-col gap-1 font-mono text-[10px] text-muted-foreground">
            <span>Name</span>
            <input
              class="rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground"
              type="text"
              maxlength={80}
              placeholder={defaultName || "Session…"}
              bind:value={sessionName}
              disabled={busy}
            />
          </label>
        {/if}
        <button type="button" class={className} disabled={busy || !checked} onclick={() => void start(true)}>
          <PlayIcon class="size-3.5" aria-hidden="true" />
          {busy ? "Starting…" : label}
        </button>
      </span>
      {#if showPerpetualOption}
        <label class="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <button
            type="button"
            class="zap-toggle"
            role="switch"
            aria-checked={perpetual}
            aria-label="Perpetual session"
            disabled={busy}
            onclick={() => {
              perpetual = !perpetual;
            }}
          >
            <span class="zap-toggle-thumb"></span>
          </button>
          Perpetual (persists when idle)
        </label>
      {/if}
    {/if}
  {:else}
    <span class="inline-flex flex-wrap items-center gap-2">
      {#if liveId}
        <button type="button" class={className} disabled={busy || !checked} onclick={() => void goResume()}>
          <PlayIcon class="size-3.5" aria-hidden="true" />
          {busy ? "…" : liveRole === "guest" ? "Resume (guest)" : label.includes("Resume") ? label : "Resume session"}
        </button>
        {#if canStart}
          <button
            type="button"
            class="rounded border border-border px-2 py-1.5 font-mono text-[10px] text-muted-foreground hover:bg-secondary/60"
            disabled={busy}
            onclick={() => void start(true)}
          >
            New session
          </button>
        {/if}
      {:else if canStart}
        <button type="button" class={className} disabled={busy || !checked} onclick={() => void start(true)}>
          <PlayIcon class="size-3.5" aria-hidden="true" />
          {busy ? "Starting…" : label}
        </button>
      {:else}
        <a href="/join" class={className}>Join</a>
      {/if}
    </span>
    {#if liveId && liveTitle}
      <span class="max-w-xs font-mono text-[10px] text-muted-foreground">Left at: {liveTitle}</span>
    {/if}
    {#if showNameOption && canStart}
      <label class="flex w-full max-w-xs flex-col gap-1 font-mono text-[10px] text-muted-foreground">
        <span>Name</span>
        <input
          class="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
          type="text"
          maxlength={80}
          placeholder={defaultName || "Session…"}
          bind:value={sessionName}
          disabled={busy}
        />
      </label>
    {/if}
    {#if showPerpetualOption && canStart}
      <label class="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
        <button
          type="button"
          class="zap-toggle"
          role="switch"
          aria-checked={perpetual}
          aria-label="Perpetual session"
          disabled={busy}
          onclick={() => {
            perpetual = !perpetual;
          }}
        >
          <span class="zap-toggle-thumb"></span>
        </button>
        Perpetual (persists when idle)
      </label>
    {/if}
  {/if}
  {#if busy}
    <BusyStatus label="Starting session…" />
  {/if}
</span>
