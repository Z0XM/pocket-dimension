<script lang="ts">
  let {
    label = "Start session",
    class: className = "rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40",
    /** When false, hide create/new — guests Join/Resume only. */
    allowStart = true,
  }: {
    label?: string;
    class?: string;
    allowStart?: boolean;
  } = $props();

  let busy = $state(false);
  let error = $state<string | null>(null);
  let liveId = $state<string | null>(null);
  let liveTitle = $state<string | null>(null);
  let liveRole = $state<"host" | "guest" | null>(null);
  let canStart = $state(allowStart);
  let checked = $state(false);

  $effect(() => {
    canStart = allowStart;
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
      error = "Guests can’t start sessions — join or resume instead.";
      return;
    }
    busy = true;
    error = null;
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ forceNew: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Could not start session (${res.status})`);
      const id = body?.session?.id;
      if (!id) throw new Error("No session id returned");
      window.location.href = `/session/${id}`;
    } catch (err) {
      error = err instanceof Error ? err.message : "Could not start session";
      busy = false;
    }
  }
</script>

<span class="inline-flex flex-col items-start gap-1">
  <span class="inline-flex flex-wrap items-center gap-2">
    {#if liveId}
      <button type="button" class={className} disabled={busy || !checked} onclick={() => void goResume()}>
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
        {busy ? "Starting…" : label}
      </button>
    {:else}
      <a href="/join" class={className}>Join</a>
    {/if}
  </span>
  {#if liveId && liveTitle}
    <span class="max-w-xs font-mono text-[10px] text-muted-foreground">Left at: {liveTitle}</span>
  {/if}
  {#if error}
    <span class="max-w-xs font-mono text-[10px] text-destructive">{error}</span>
  {/if}
</span>
