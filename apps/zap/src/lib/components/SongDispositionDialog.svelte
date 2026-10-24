<script lang="ts">
  let {
    open = $bindable(false),
    title = "Remove song?",
    body = "",
    busy = false,
    showArchive = true,
    onarchive,
    ondelete,
  }: {
    open?: boolean;
    title?: string;
    body?: string;
    busy?: boolean;
    /** When false (already archived), only Cancel / Delete are offered. */
    showArchive?: boolean;
    onarchive: () => void | Promise<void>;
    ondelete: () => void | Promise<void>;
  } = $props();

  let dialog = $state<HTMLDialogElement | null>(null);

  $effect(() => {
    const el = dialog;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  });

  function onCancel() {
    if (busy) return;
    open = false;
  }

  async function onArchiveClick() {
    if (busy) return;
    await onarchive();
  }

  async function onDeleteClick() {
    if (busy) return;
    await ondelete();
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
  <div class="space-y-4 p-5">
    <div>
      <h2 class="text-lg font-semibold tracking-tight">{title}</h2>
      {#if body}
        <p class="mt-2 text-sm text-muted-foreground">{body}</p>
      {/if}
    </div>
    <div class="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        class="rounded border border-border bg-transparent px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40"
        disabled={busy}
        onclick={onCancel}
      >
        Cancel
      </button>
      {#if showArchive}
        <button
          type="button"
          class="rounded border border-border bg-transparent px-3 py-1.5 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-40"
          disabled={busy}
          onclick={() => void onArchiveClick()}
        >
          {busy ? "Working…" : "Archive"}
        </button>
      {/if}
      <button
        type="button"
        class="rounded border border-destructive/50 bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-40"
        disabled={busy}
        onclick={() => void onDeleteClick()}
      >
        {busy ? "Working…" : "Delete"}
      </button>
    </div>
  </div>
</dialog>
