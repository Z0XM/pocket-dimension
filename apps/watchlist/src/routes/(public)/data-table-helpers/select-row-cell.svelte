<script lang="ts">
  import { Checkbox } from "$lib/components/ui/checkbox";
  import { getEditModeContext } from "./edit-mode.svelte.js";

  interface Props {
    rowId: string;
    rowIndex: number;
    allRowIds: string[];
    isHeader?: boolean;
  }

  let { rowId, rowIndex, allRowIds, isHeader = false }: Props = $props();

  const editMode = getEditModeContext();

  // Check if row is selected
  const isSelected = $derived(editMode.isRowSelected(rowId));
  const isDeleted = $derived(editMode.isRowDeleted(rowId));

  // For header: check if all visible rows are selected
  const allSelected = $derived.by(() => {
    if (!isHeader) return false;
    const selectableIds = allRowIds.filter((id) => !editMode.isRowDeleted(id));
    if (selectableIds.length === 0) return false;
    return selectableIds.every((id) => editMode.isRowSelected(id));
  });

  const someSelected = $derived.by(() => {
    if (!isHeader) return false;
    const selectableIds = allRowIds.filter((id) => !editMode.isRowDeleted(id));
    if (selectableIds.length === 0) return false;
    const selectedCount = selectableIds.filter((id) => editMode.isRowSelected(id)).length;
    return selectedCount > 0 && selectedCount < selectableIds.length;
  });

  function handleChange(checked: boolean | "indeterminate") {
    if (isHeader) {
      if (checked === true) {
        editMode.selectAllRows(allRowIds.filter((id) => !editMode.isRowDeleted(id)));
      } else {
        editMode.clearSelection();
      }
    } else {
      editMode.toggleRowSelection(rowId);
      editMode.setLastSelectedIndex(rowIndex);
    }
  }

  function handleClick(e: MouseEvent) {
    if (!isHeader && e.shiftKey) {
      e.preventDefault();
      editMode.handleShiftSelect(allRowIds, rowIndex);
    }
  }
</script>

{#if editMode.isEditMode}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="flex items-center justify-center" onclick={handleClick}>
    <Checkbox
      checked={isHeader ? allSelected : isSelected}
      indeterminate={isHeader && someSelected}
      onCheckedChange={handleChange}
      disabled={!isHeader && isDeleted}
      class="cursor-pointer border-white/30 {isDeleted ? 'opacity-50' : ''}"
    />
  </div>
{/if}
