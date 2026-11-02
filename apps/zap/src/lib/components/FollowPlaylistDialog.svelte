<script lang="ts">
  import UserPlusIcon from "@lucide/svelte/icons/user-plus";
  import XIcon from "@lucide/svelte/icons/x";
  import { toast } from "$lib/toast.svelte";

  let {
    open = $bindable(false),
    onfollowed,
  }: {
    open?: boolean;
    onfollowed?: (id: string) => void;
  } = $props();

  let dialog = $state<HTMLDialogElement | null>(null);
  let shareCode = $state("");
  let busy = $state(false);

  $effect(() => {
    const el = dialog;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
      shareCode = "";
    } else if (el.open) {
      el.close();
    }
  });

  function close() {
    if (busy) return;
    open = false;
  }

  async function follow() {
    if (!shareCode.trim() || busy) return;
    busy = true;
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "follow", shareCode: shareCode.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message ?? "Follow failed");
      open = false;
      onfollowed?.(body.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Follow failed");
    } finally {
      busy = false;
    }
  }
</script>

<dialog
  bind:this={dialog}
  class="zap-dialog m-auto w-[min(100%,24rem)] overflow-hidden rounded-none border border-border bg-card p-0 text-foreground shadow-none backdrop:bg-black/55"
  onclose={() => (open = false)}
  onclick={(e) => {
    if (e.target === dialog) close();
  }}
>
  <header class="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
    <h2 class="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">Follow playlist</h2>
    <button type="button" class="zap-transport-btn size-8" aria-label="Close" disabled={busy} onclick={close}>
      <XIcon class="size-3.5" />
    </button>
  </header>
  <form
    class="space-y-3 px-4 py-3"
    onsubmit={(e) => {
      e.preventDefault();
      void follow();
    }}
  >
    <p class="font-mono text-[10px] text-muted-foreground">Enter a public share code. Following is read-only — play only.</p>
    <label class="block space-y-1">
      <span class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Share code</span>
      <input class="zap-underline-field font-mono uppercase" bind:value={shareCode} maxlength="12" placeholder="Code…" disabled={busy} />
    </label>
    <div class="flex justify-end gap-2 pt-1">
      <button type="button" class="rounded border border-border px-3 py-1.5 font-mono text-[11px]" disabled={busy} onclick={close}>Cancel</button>
      <button
        type="submit"
        class="inline-flex items-center gap-1.5 rounded border border-signal/40 px-3 py-1.5 text-xs font-medium text-signal hover:bg-signal/10 disabled:opacity-40"
        disabled={busy || !shareCode.trim()}
      >
        <UserPlusIcon class="size-3.5" />
        {busy ? "Following…" : "Follow"}
      </button>
    </div>
  </form>
</dialog>
