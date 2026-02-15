<script lang="ts">
  import { TriangleAlert } from "@lucide/svelte";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
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

  const canConfirm = $derived(!requireConfirmText || confirmText.toUpperCase() === "DELETE");

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

<AlertDialog.Root bind:open>
  <AlertDialog.Portal>
    <AlertDialog.Overlay />
    <AlertDialog.Content>
      <AlertDialog.Header>
        <AlertDialog.Title class="flex items-center gap-2 text-red-600">
          <TriangleAlert class="size-5" />
          Confirm Deletion
        </AlertDialog.Title>
        <AlertDialog.Description>
          {#if titles.length === 1}
            Are you sure you want to delete this watch item?
          {:else}
            Are you sure you want to delete {titles.length} watch items?
          {/if}
        </AlertDialog.Description>
      </AlertDialog.Header>

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
              onkeydown={(e) => {
                if (e.key === "Enter" && canConfirm) {
                  handleConfirm();
                }
              }}
            />
          </div>
        {/if}

        <p class="text-sm text-red-600">This action cannot be undone. The items will be permanently removed.</p>
      </div>

      <AlertDialog.Footer>
        <AlertDialog.Cancel class="dark:hover:bg-white/70 dark:bg-gray-200 text-black hover:text-black" onclick={handleCancel}>
          Cancel
        </AlertDialog.Cancel>
        <AlertDialog.Action onclick={handleConfirm} disabled={!canConfirm} class="dark:bg-rose-500 dark:hover:bg-rose-800">
          Delete {titles.length > 1 ? `${titles.length} Items` : "Item"}
        </AlertDialog.Action>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Portal>
</AlertDialog.Root>
