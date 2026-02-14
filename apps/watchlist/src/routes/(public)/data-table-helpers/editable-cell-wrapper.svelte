<script lang="ts">
import { RotateCcwIcon } from "@lucide/svelte";
import { Button } from "$lib/components/ui/button";
import { getEditModeContext } from "./edit-mode.svelte.js";

interface Props {
  rowId: string;
  field: string;
  canEdit: boolean;
  children: import("svelte").Snippet;
  class?: string;
  /** Additional fields to check for "edited" state (for compound cells like rating) */
  additionalFields?: string[];
  /** Custom undo handler (for compound cells that need to undo multiple fields) */
  onUndo?: () => void;
  /** Override the internal isEdited check (for special cases like tags) */
  isEditedOverride?: boolean;
}

let { rowId, field, canEdit, children, class: className = "", additionalFields = [], onUndo, isEditedOverride }: Props = $props();

const editMode = getEditModeContext();

// Derived state - check primary field AND any additional fields (unless overridden)
const isEdited = $derived(
  isEditedOverride !== undefined
    ? isEditedOverride
    : editMode.isFieldChanged(rowId, field) || additionalFields.some((f) => editMode.isFieldChanged(rowId, f))
);
const hasError = $derived(editMode.hasFieldError(rowId, field));
const errorMessage = $derived(editMode.getValidationError(rowId, field));

function handleUndo() {
  if (onUndo) {
    onUndo();
  } else {
    editMode.undoFieldEdit(rowId, field as any);
  }
}

// Compute CSS classes based on state
const wrapperClasses = $derived.by(() => {
  const classes = ["relative"];

  if (editMode.isEditMode && canEdit) {
    classes.push("editable-cell");
  }

  // if (hasError) {
  //   classes.push("cell-error");
  // }

  if (className) {
    classes.push(className);
  }

  return classes.join(" ");
});
</script>

<div class={wrapperClasses} title={hasError ? errorMessage : undefined}>
  {@render children()}

  <!-- Undo button - shows when cell has changes -->
  {#if editMode.isEditMode && canEdit && isEdited && !hasError}
    <Button
      size="icon"
      onclick={handleUndo}
      class="absolute -top-1 -right-1 size-3 dark:hover:bg-amber-800/30 hover:scale-125 bg-amber-600/80 text-transparent hover:text-amber-300 backdrop-blur-md  flex items-center justify-center   rounded-full shadow-sm transition-colors z-10"
      title="Undo change"
    >
      <RotateCcwIcon class="size-3 animate-pulse" />
    </Button>
  {/if}

  <!-- Error indicator -->
  {#if hasError}
    <div
      class="absolute -top-1 -right-1 size-2 bg-rose-500 hover:scale-125 rounded-full animate-pulse"
      title={errorMessage}
    ></div>
  {/if}
</div>

<style>
  .editable-cell {
    min-height: 2rem;
  }
</style>
