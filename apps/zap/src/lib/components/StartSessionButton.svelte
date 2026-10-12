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

  async function start() {
    busy = true;
    error = null;
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: "{}",
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
  <button type="button" class={className} disabled={busy} onclick={() => void start()}>
    {busy ? "Starting…" : label}
  </button>
  {#if error}
    <span class="max-w-xs font-mono text-[10px] text-destructive">{error}</span>
  {/if}
</span>
