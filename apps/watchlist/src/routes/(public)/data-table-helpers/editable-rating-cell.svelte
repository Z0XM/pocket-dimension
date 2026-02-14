<script lang="ts">
import { getContext } from "svelte";
import { Button } from "$lib/components/ui/button";
import { Input } from "$lib/components/ui/input";
import { getEditModeContext, type UserRole } from "./edit-mode.svelte.js";
import EditableCellWrapper from "./editable-cell-wrapper.svelte";

interface Props {
  rowId: string;
  rating: string | null;
  infinity: boolean | null;
  shitty: boolean | null;
  progressStatus: string | null;
  class?: string;
}

let { rowId, rating, infinity, shitty, progressStatus, class: className = "" }: Props = $props();

const editMode = getEditModeContext();
const editOptions = getContext<{ userRole: () => UserRole }>("editOptions");

// Get current progress status (edited or original)
// Read directly from editedRows for proper reactivity
const currentProgressStatus = $derived.by(() => {
  const rowEdits = editMode.editedRows.get(rowId);
  const editedValue = rowEdits?.my_progress_status;
  return editedValue !== undefined ? editedValue : progressStatus;
});

// Check if progress is "watched" or "dropped" - ratings are only editable for these statuses
const canRate = $derived(currentProgressStatus === "watched" || currentProgressStatus === "dropped");

// All users can edit their own rating, but only if progress is "watched" or "dropped"
const canEdit = $derived(editMode.canEditField(editOptions.userRole(), "my_rating") && canRate);

// Get current values (edited or original)
// Read directly from editedRows for proper reactivity
const currentRating = $derived.by(() => {
  const rowEdits = editMode.editedRows.get(rowId);
  const editedValue = rowEdits?.my_rating;
  return editedValue !== undefined ? editedValue : rating;
});
const currentInfinity = $derived.by(() => {
  const rowEdits = editMode.editedRows.get(rowId);
  const editedValue = rowEdits?.my_infinity;
  return editedValue !== undefined ? editedValue : infinity;
});
const currentShitty = $derived.by(() => {
  const rowEdits = editMode.editedRows.get(rowId);
  const editedValue = rowEdits?.my_shitty;
  return editedValue !== undefined ? editedValue : shitty;
});

// Determine current mode: 'rating', 'infinity', or 'shitty'
const currentMode = $derived.by(() => {
  return currentInfinity ? "infinity" : currentShitty ? "shitty" : "rating";
});

function handleRatingInput(e: Event) {
  const target = e.currentTarget as HTMLInputElement;
  let newValue = target.value;

  // Validate rating is between 0 and 10
  const numValue = parseFloat(newValue);
  if (!Number.isNaN(numValue)) {
    if (numValue < 0) newValue = "0";
    if (numValue > 10) newValue = "10";
  }

  // Mark all rating-related fields
  editMode.markFieldEdited(rowId, "my_rating", newValue || null, rating);
  editMode.markFieldEdited(rowId, "my_infinity", false, infinity);
  editMode.markFieldEdited(rowId, "my_shitty", false, shitty);

  // Validate
  if (newValue && (Number.isNaN(parseFloat(newValue)) || parseFloat(newValue) < 0 || parseFloat(newValue) > 10)) {
    editMode.setValidationError(rowId, "my_rating", "Rating must be between 0 and 10");
  } else {
    editMode.clearValidationError(rowId, "my_rating");
  }
}

function setInfinity() {
  editMode.markFieldEdited(rowId, "my_infinity", true, infinity);
  editMode.markFieldEdited(rowId, "my_shitty", false, shitty);
  editMode.markFieldEdited(rowId, "my_rating", null, rating);
  editMode.clearValidationError(rowId, "my_rating");
}

function setShitty() {
  editMode.markFieldEdited(rowId, "my_shitty", true, shitty);
  editMode.markFieldEdited(rowId, "my_infinity", false, infinity);
  editMode.markFieldEdited(rowId, "my_rating", null, rating);
  editMode.clearValidationError(rowId, "my_rating");
}

function clearSpecial() {
  editMode.markFieldEdited(rowId, "my_infinity", false, infinity);
  editMode.markFieldEdited(rowId, "my_shitty", false, shitty);
}

// Toggle functions - check mode at call time and dispatch to correct handler
function toggleInfinity() {
  if (currentMode === "infinity") {
    clearSpecial();
  } else {
    setInfinity();
  }
}

function toggleShitty() {
  if (currentMode === "shitty") {
    clearSpecial();
  } else {
    setShitty();
  }
}

// Custom undo handler that undoes all rating-related fields
function handleRatingUndo() {
  editMode.undoFieldEdit(rowId, "my_rating");
  editMode.undoFieldEdit(rowId, "my_infinity");
  editMode.undoFieldEdit(rowId, "my_shitty");
}

// Format rating for display
function formatRating(r: string | null): string {
  if (!r) return "";
  const num = parseFloat(r);
  return Number.isNaN(num) ? "" : num.toFixed(1);
}

// Get color style based on rating value
function getRatingColor(rating: string | null): string {
  if (!rating) return "";
  const num = parseFloat(rating);
  if (Number.isNaN(num)) return "";

  // Map rating ranges to hex colors
  if (num >= 10) return "color: #61ED51;";
  if (num >= 9) return "color: #80EC51;";
  if (num >= 8) return "color: #9EEA4E;";
  if (num >= 7) return "color: #BAE84C;";
  if (num >= 6) return "color: #DAE54A;";
  if (num >= 5) return "color: #E2CC45;";
  if (num >= 4) return "color: #DCA93D;";
  if (num >= 3) return "color: #D58235;";
  if (num >= 2) return "color: #CE5A2C;";
  if (num >= 1) return "color: #C73024;";
  return "color: #880A00;";
}
</script>

<EditableCellWrapper
  {rowId}
  field="my_rating"
  {canEdit}
  class={className}
  additionalFields={["my_infinity", "my_shitty"]}
  onUndo={handleRatingUndo}
>
  {#if editMode.isEditMode && canEdit}
    <div class="flex items-center gap-1 justify-end">
      {#if currentMode === "rating"}
        <Input
          type="number"
          min="0"
          max="10"
          step="0.5"
          value={currentRating ?? ""}
          oninput={handleRatingInput}
          placeholder="0-10"
          class=" text-xs w-fit text-end [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      {/if}
      <div class="flex gap-0.5">
        <Button
          variant={currentMode === "infinity" ? "outline" : "ghost"}
          size="sm"
          onclick={toggleInfinity}
          class="h-8 w-8 p-0 text-base {currentMode === 'infinity'
            ? 'border-green-500/50'
            : ''}"
          title="Mark as Infinity"
        >
          ♾️
        </Button>
        <Button
          variant={currentMode === "shitty" ? "outline" : "ghost"}
          size="sm"
          onclick={toggleShitty}
          class="h-8 w-8 p-0 text-base {currentMode === 'shitty'
            ? 'border-green-500/50'
            : ''}"
          title="Mark as Shitty"
        >
          💩
        </Button>
      </div>
    </div>
  {:else}
    <div
      class="text-end font-medium {!canRate ? 'text-muted-foreground/50' : ''}"
    >
      {#if !canRate}
        <span title="Set progress to 'Watched' or 'Dropped' to enable rating"
          >-</span
        >
      {:else if currentInfinity}
        <span title="Infinity" class="text-lg">♾️</span>
      {:else if currentShitty}
        <span title="Shitty" class="text-lg">💩</span>
      {:else}
        <span style={getRatingColor(currentRating)}
          >{formatRating(currentRating)}</span
        >
      {/if}
    </div>
  {/if}
</EditableCellWrapper>
