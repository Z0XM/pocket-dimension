<script lang="ts">
import { AlertTriangleIcon } from "@lucide/svelte";
import { Button } from "$lib/components/ui/button";
import * as Dialog from "$lib/components/ui/dialog";
import { Input } from "$lib/components/ui/input";

interface Props {
  open: boolean;
  titles: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

let { open = $bindable(), titles, onConfirm, onCancel }: Props = $props();

// For bulk deletes (>1), require typing DELETE
const requireConfirmText = $derived(titles.length > 1);
let confirmText = $state("");

const canConfirm = $derived(
  !requireConfirmText || confirmText.toUpperCase() === "DELETE"
);

function handleConfirm() {
  if (!canConfirm) return;
  confirmText = "";
  onConfirm();
}

function handleCancel() {
  confirmText = "";
  onCancel();
}

// Reset confirm text when dialog opens/closes
$effect(() => {
  if (!open) {
    confirmText = "";
  }
});
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2 text-red-600">
        <AlertTriangleIcon class="size-5" />
        Confirm Deletion
      </Dialog.Title>
      <Dialog.Description>
        {#if titles.length === 1}
          Are you sure you want to delete this watch item?
        {:else}
          Are you sure you want to delete {titles.length} watch items?
        {/if}
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4 py-4">
      <!-- List of items to be deleted -->
      <div class="max-h-40 overflow-y-auto space-y-1 bg-muted/50 rounded-md p-3">
        {#each titles as title (title)}
          <div class="text-sm text-muted-foreground flex items-center gap-2">
            <span class="size-1.5 rounded-full bg-red-500"></span>
            <span class="truncate">{title}</span>
          </div>
        {/each}
      </div>

      <!-- Confirm text for bulk delete -->
      {#if requireConfirmText}
        <div class="space-y-2">
          <p class="text-sm text-muted-foreground">
            Type <span class="font-semibold text-foreground">DELETE</span> to confirm:
          </p>
          <Input
            type="text"
            bind:value={confirmText}
            placeholder="DELETE"
            class="uppercase"
          />
        </div>
      {/if}

      <p class="text-sm text-red-600">
        This action cannot be undone. The items will be permanently removed.
      </p>
    </div>

    <Dialog.Footer class="flex gap-2">
      <Button variant="outline" onclick={handleCancel}>
        Cancel
      </Button>
      <Button
        variant="destructive"
        onclick={handleConfirm}
        disabled={!canConfirm}
      >
        Delete {titles.length > 1 ? `${titles.length} Items` : "Item"}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
