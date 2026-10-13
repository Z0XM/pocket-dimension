<script lang="ts">
  let {
    label = "Start session",
    class: className = "rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40",
  }: {
    label?: string;
    class?: string;
  } = $props();

  let busy = $state(false);
  let error = $state<string | null>(null);
  let liveId = $state<string | null>(null);
  let liveTitle = $state<string | null>(null);
  let checked = $state(false);

  $effect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/sessions", { credentials: "same-origin", headers: { Accept: "application/json" } });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as {
          sessionId?: string | null;
          live?: { id: string; role: string; currentTitle: string | null }[];
        };
        const host = body.live?.find((s) => s.role === "host") ?? (body.sessionId ? { id: body.sessionId, currentTitle: null } : null);
        if (!cancelled && host) {
          liveId = host.id;
          liveTitle = "currentTitle" in host ? (host.currentTitle ?? null) : null;
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

  async function start(forceNew = false) {
    if (!forceNew && liveId) {
      window.location.href = `/session/${liveId}`;
      return;
    }
    busy = true;
    error = null;
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ forceNew }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message ?? `Could not start session (${res.status})`);
      }
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
    <button type="button" class={className} disabled={busy || !checked} onclick={() => void start(false)}>
      {#if busy}
        Starting…
      {:else if liveId}
        Resume session
      {:else}
        {label}
      {/if}
    </button>
    {#if liveId}
      <button
        type="button"
        class="rounded border border-border px-2 py-1.5 font-mono text-[10px] text-muted-foreground hover:bg-secondary/60"
        disabled={busy}
        onclick={() => void start(true)}
      >
        New session
      </button>
    {/if}
  </span>
  {#if liveId && liveTitle}
    <span class="max-w-xs font-mono text-[10px] text-muted-foreground">Left at: {liveTitle}</span>
  {/if}
  {#if error}
    <span class="max-w-xs font-mono text-[10px] text-destructive">{error}</span>
  {/if}
</span>
