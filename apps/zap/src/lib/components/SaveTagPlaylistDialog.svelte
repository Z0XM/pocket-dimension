<script lang="ts">
  let {
    open = $bindable(false),
    tagQuery,
    defaultName = "",
    onsaved,
  }: {
    open?: boolean;
    /** Tag query the playlist is created from (already resolved from chips when needed). */
    tagQuery: string;
    defaultName?: string;
    onsaved: (playlist: { id: string; name: string; tagQuery: string | null; trackCount: number }) => void;
  } = $props();

  let dialog = $state<HTMLDialogElement | null>(null);
  let nameInput = $state<HTMLInputElement | null>(null);
  let name = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    const el = dialog;
    if (!el) return;
    if (open) {
      if (!el.open) {
        name = defaultName.slice(0, 80);
        error = null;
        el.showModal();
        queueMicrotask(() => nameInput?.select());
      }
    } else if (el.open) {
      el.close();
    }
  });

  async function save(e: SubmitEvent) {
    e.preventDefault();
    if (busy || !name.trim()) return;
    busy = true;
    error = null;
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), tagQuery }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "Save failed");
      onsaved(body);
      open = false;
    } catch (err) {
      error = err instanceof Error ? err.message : "Save failed";
    } finally {
      busy = false;
    }
  }
</script>

<dialog
  bind:this={dialog}
  class="zap-dialog m-auto w-[min(100%,24rem)] rounded-lg border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-background/80"
  onclose={() => {
    open = false;
  }}
  oncancel={(e) => {
    if (busy) e.preventDefault();
  }}
>
  <form class="space-y-4 p-5" onsubmit={save}>
    <div>
      <h2 class="text-lg font-semibold tracking-tight">Save as playlist</h2>
      <p class="mt-1 text-sm text-muted-foreground">Builds a playlist from your tags matching this query. Search text is not included.</p>
    </div>
    <p class="rounded border border-border/70 bg-background/60 px-2 py-1.5 font-mono text-xs break-words text-signal">{tagQuery}</p>
    <label class="block space-y-1">
      <span class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Name</span>
      <input class="auth-field" bind:this={nameInput} bind:value={name} maxlength="80" placeholder="Playlist name…" required />
    </label>
    {#if error}
      <p class="auth-error mb-0 p-2 text-xs">{error}</p>
    {/if}
    <div class="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        class="rounded border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary disabled:opacity-40"
        disabled={busy}
        onclick={() => (open = false)}
      >
        Cancel
      </button>
      <button
        type="submit"
        class="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
        disabled={busy || !name.trim()}
      >
        {busy ? "Saving…" : "Save playlist"}
      </button>
    </div>
  </form>
</dialog>
