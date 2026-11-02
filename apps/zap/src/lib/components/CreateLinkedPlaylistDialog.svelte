<script lang="ts">
  import LinkIcon from "@lucide/svelte/icons/link";
  import XIcon from "@lucide/svelte/icons/x";
  import { toast } from "$lib/toast.svelte";

  let {
    open = $bindable(false),
    oncreated,
  }: {
    open?: boolean;
    oncreated?: (id: string) => void;
  } = $props();

  let dialog = $state<HTMLDialogElement | null>(null);
  let name = $state("");
  let codeInput = $state("");
  let memberQuery = $state("");
  let sources = $state<{ id: string; name: string; ownerUserId: string; shareCode: string | null }[]>([]);
  let busy = $state(false);

  $effect(() => {
    const el = dialog;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
      name = "";
      codeInput = "";
      memberQuery = "";
      sources = [];
    } else if (el.open) {
      el.close();
    }
  });

  function close() {
    if (busy) return;
    open = false;
  }

  async function addSource() {
    if (!codeInput.trim() || busy) return;
    busy = true;
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lookupShareCode", shareCode: codeInput.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "Lookup failed");
      if (sources.some((s) => s.id === body.id)) throw new Error("Already added");
      if (sources.some((s) => s.ownerUserId === body.ownerUserId)) {
        throw new Error("Sources must belong to different accounts");
      }
      const entered = codeInput.trim().toUpperCase();
      sources = [...sources, { id: body.id, name: body.name, ownerUserId: body.ownerUserId, shareCode: body.shareCode ?? entered }];
      codeInput = "";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      busy = false;
    }
  }

  async function create() {
    if (!name.trim() || sources.length < 2 || busy) return;
    busy = true;
    try {
      const members = memberQuery
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/playlists", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createLinked",
          name: name.trim(),
          sourcePlaylistIds: sources.map((s) => s.id),
          memberQueries: members,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "Create failed");
      open = false;
      oncreated?.(body.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      busy = false;
    }
  }
</script>

<dialog
  bind:this={dialog}
  class="zap-dialog m-auto w-[min(100%,28rem)] max-h-[min(90dvh,36rem)] overflow-hidden rounded-none border border-border bg-card p-0 text-foreground shadow-none backdrop:bg-black/55"
  onclose={() => (open = false)}
  onclick={(e) => {
    if (e.target === dialog) close();
  }}
>
  <div class="flex max-h-[min(90dvh,36rem)] flex-col">
    <header class="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
      <h2 class="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">Create linked playlist</h2>
      <button type="button" class="zap-transport-btn size-8" aria-label="Close" disabled={busy} onclick={close}>
        <XIcon class="size-3.5" />
      </button>
    </header>
    <div class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
      <p class="font-mono text-[10px] text-muted-foreground">
        Combine public playlists from <span class="text-signal">different accounts</span>. Tracks update from sources; no hand adds.
      </p>
      <label class="block space-y-1">
        <span class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Name</span>
        <input class="zap-underline-field" bind:value={name} placeholder="Linked mix…" maxlength="80" disabled={busy} />
      </label>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label class="flex-1 space-y-1">
          <span class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Source share code</span>
          <input class="zap-underline-field font-mono uppercase" bind:value={codeInput} placeholder="Code…" maxlength="12" disabled={busy} />
        </label>
        <button
          type="button"
          class="rounded border border-border px-3 py-2 font-mono text-[11px] disabled:opacity-40"
          disabled={busy || !codeInput.trim()}
          onclick={() => void addSource()}
        >
          Add source
        </button>
      </div>
      {#if sources.length}
        <ul class="space-y-1 font-mono text-[11px] text-muted-foreground">
          {#each sources as src (src.id)}
            <li class="flex items-center justify-between gap-2">
              <span class="min-w-0 truncate"
                >{src.name}{#if src.shareCode}
                  · {src.shareCode}{/if}</span
              >
              <button
                type="button"
                class="text-destructive hover:underline"
                disabled={busy}
                onclick={() => (sources = sources.filter((s) => s.id !== src.id))}>Remove</button
              >
            </li>
          {/each}
        </ul>
      {/if}
      <label class="block space-y-1">
        <span class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Members (optional)</span>
        <input class="zap-underline-field" bind:value={memberQuery} placeholder="email or username, comma-separated" disabled={busy} />
      </label>
    </div>
    <footer class="flex justify-end gap-2 border-t border-border/60 px-4 py-3">
      <button type="button" class="rounded border border-border px-3 py-1.5 font-mono text-[11px]" disabled={busy} onclick={close}>Cancel</button>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
        disabled={busy || !name.trim() || sources.length < 2}
        onclick={() => void create()}
      >
        <LinkIcon class="size-3.5" />
        {busy ? "Creating…" : `Create (${sources.length} sources)`}
      </button>
    </footer>
  </div>
</dialog>
