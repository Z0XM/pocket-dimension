<script lang="ts">
  import { Trash2Icon, RotateCcwIcon, XIcon } from "@lucide/svelte";
  import { getContext } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { getEditModeContext, type UserRole } from "./edit-mode.svelte.js";

  interface Props {
    rowId: string;
    isNewRow?: boolean;
  }

  let { rowId, isNewRow = false }: Props = $props();

  const editMode = getEditModeContext();
  const editOptions = getContext<{ userRole: () => UserRole }>("editOptions");

  const userRole = $derived(editOptions.userRole());
  const canDelete = $derived(editMode.canDeleteRows(userRole));
  const isDeleted = $derived(editMode.isRowDeleted(rowId));

  function handleDelete() {
    if (isNewRow) {
      // Remove the temporary new row
      editMode.removeNewRow(rowId);
    } else {
      // Toggle delete state
      if (isDeleted) {
        editMode.unmarkRowDeleted(rowId);
      } else {
        editMode.markRowDeleted(rowId);
      }
    }
  }
</script>

{#if editMode.isEditMode}
  <div class="flex items-center justify-end gap-1">
    {#if isNewRow}
      <!-- For new rows, show X to remove (available to contributors too) -->
      <Button
        variant="ghost"
        size="sm"
        onclick={handleDelete}
        class="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
        title="Remove new row"
      >
        <XIcon class="size-4" />
      </Button>
    {:else if canDelete}
      <!-- For existing rows, show delete toggle (admin only) -->
      <Button
        variant="ghost"
        size="sm"
        onclick={handleDelete}
        class="h-7 w-7 p-0 {isDeleted
          ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950'
          : 'text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950'}"
        title={isDeleted ? "Undo delete" : "Mark for deletion"}
      >
        {#if isDeleted}
          <RotateCcwIcon class="size-4" />
        {:else}
          <Trash2Icon class="size-4" />
        {/if}
      </Button>
    {/if}
  </div>
{/if}
