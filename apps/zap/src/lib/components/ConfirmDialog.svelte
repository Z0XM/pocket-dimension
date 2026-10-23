<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    open = $bindable(false),
    title = "Confirm",
    body = "",
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    danger = false,
    busy = false,
    onconfirm,
    children,
  }: {
    open?: boolean;
    title?: string;
    body?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    busy?: boolean;
    onconfirm: () => void | Promise<void>;
    children?: Snippet;
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

  async function onConfirmClick() {
    if (busy) return;
    await onconfirm();
  }
</script>

<dialog
  bind:this={dialog}
  class="zap-dialog m-auto w-[min(100%,22rem)] rounded-lg border border-border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-background/80"
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
      {#if children}
        <div class="mt-2">{@render children()}</div>
      {:else if body}
        <p class="mt-2 text-sm text-muted-foreground">{body}</p>
      {/if}
    </div>
    <div class="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        class="rounded border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary disabled:opacity-40"
        disabled={busy}
        onclick={onCancel}
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        class={`rounded px-3 py-1.5 text-sm font-medium disabled:opacity-40 ${
          danger ? "bg-destructive text-destructive-foreground hover:opacity-90" : "bg-primary text-primary-foreground hover:opacity-90"
        }`}
        disabled={busy}
        onclick={() => void onConfirmClick()}
      >
        {busy ? "Working…" : confirmLabel}
      </button>
    </div>
  </div>
</dialog>
