<script lang="ts">
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";

  type SessionIndexRowData = {
    id: string;
    joinCode: string;
    name: string;
    role: "host" | "guest";
    currentTitle: string | null;
    perpetual: boolean;
    canRename: boolean;
    canClose: boolean;
  };

  let {
    row,
    mode,
    onchanged,
  }: {
    row: SessionIndexRowData;
    mode: "live" | "stale";
    onchanged: () => void;
  } = $props();

  let editing = $state(false);
  let draftName = $state("");
  let busy = $state(false);
  let error = $state<string | null>(null);
  let closeOpen = $state(false);

  function beginRename() {
    draftName = row.name;
    editing = true;
    error = null;
  }

  function cancelRename() {
    if (busy) return;
    editing = false;
    error = null;
  }

  async function saveRename() {
    if (busy) return;
    busy = true;
    error = null;
    try {
      const res = await fetch(`/api/sessions/${row.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ name: draftName }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Could not rename (${res.status})`);
      editing = false;
      onchanged();
    } catch (err) {
      error = err instanceof Error ? err.message : "Could not rename";
    } finally {
      busy = false;
    }
  }

  async function closeSession() {
    if (busy) return;
    busy = true;
    error = null;
    try {
      const res = await fetch(`/api/sessions/${row.id}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? `Could not close (${res.status})`);
      closeOpen = false;
      onchanged();
    } catch (err) {
      error = err instanceof Error ? err.message : "Could not close session";
    } finally {
      busy = false;
    }
  }
</script>

<li class="flex flex-col gap-2 rounded border border-transparent px-0 py-1 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-2">
  <span class="min-w-0 flex-1">
    {#if editing}
      <form
        class="flex flex-wrap items-center gap-2"
        onsubmit={(e) => {
          e.preventDefault();
          void saveRename();
        }}
      >
        <input
          class="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 font-mono text-xs"
          bind:value={draftName}
          maxlength={80}
          disabled={busy}
          aria-label="Session name"
        />
        <button type="submit" class="rounded border border-signal/40 px-2 py-1 font-mono text-[10px] text-signal" disabled={busy}>
          Save
        </button>
        <button type="button" class="rounded border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground" disabled={busy} onclick={cancelRename}>
          Cancel
        </button>
      </form>
    {:else}
      <span class="block truncate font-medium text-foreground">{row.name}</span>
      <span class="font-mono text-[10px] text-muted-foreground">
        {row.joinCode} · {row.role}{#if row.perpetual}
          · perpetual{/if}{#if mode === "stale"}
          · stale{/if}
      </span>
      {#if row.currentTitle}
        <span class="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
          {mode === "stale" ? "Left at: " : ""}{row.currentTitle}
        </span>
      {/if}
    {/if}
    {#if error}
      <span class="mt-1 block font-mono text-[10px] text-destructive">{error}</span>
    {/if}
  </span>

  <span class="flex shrink-0 flex-wrap items-center gap-1.5">
    {#if row.canRename && !editing}
      <button
        type="button"
        class="rounded border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground hover:bg-secondary/60"
        disabled={busy}
        onclick={beginRename}
      >
        Rename
      </button>
    {/if}
    {#if row.canClose}
      <button
        type="button"
        class="rounded border border-destructive/40 px-2 py-1 font-mono text-[10px] text-destructive hover:bg-destructive/10"
        disabled={busy}
        onclick={() => {
          closeOpen = true;
        }}
      >
        Close
      </button>
    {/if}
    <a
      href={`/session/${row.id}`}
      class={`rounded border px-2 py-1 font-mono text-[10px] ${mode === "stale" ? "border-signal/40 text-signal" : "border-border"}`}
    >
      {mode === "stale" ? "Rejoin" : "Resume"}
    </a>
  </span>
</li>

<ConfirmDialog
  bind:open={closeOpen}
  title="Close session?"
  body={row.perpetual
    ? "Ends this perpetual room for everyone and closes the join code. It will leave the sessions list."
    : "Stops playback for everyone and closes the join code."}
  confirmLabel="Close session"
  danger
  {busy}
  onconfirm={closeSession}
/>
