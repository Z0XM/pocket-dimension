<script lang="ts">
  import XIcon from "@lucide/svelte/icons/x";
  import { dismissToast, toastQueue, type ToastKind } from "$lib/toast.svelte";

  function kindClass(kind: ToastKind) {
    if (kind === "error") return "border-destructive/50 text-destructive";
    if (kind === "success") return "border-signal/50 text-signal";
    return "border-border text-foreground";
  }
</script>

{#if toastQueue.items.length > 0}
  <div
    class="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4 sm:bottom-6"
    aria-live="polite"
    aria-relevant="additions"
  >
    {#each toastQueue.items as item (item.id)}
      <div
        class={`pointer-events-auto flex max-w-md items-start gap-2 rounded border bg-popover/95 px-3 py-2 font-mono text-[11px] shadow-[0_0_0_1px_color-mix(in_srgb,var(--signal)_10%,transparent)] backdrop-blur-sm ${kindClass(item.kind)}`}
        role="status"
      >
        <p class="min-w-0 flex-1 leading-snug">{item.message}</p>
        <button
          type="button"
          class="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
          onclick={() => dismissToast(item.id)}
        >
          <XIcon class="size-3.5" aria-hidden="true" />
        </button>
      </div>
    {/each}
  </div>
{/if}
