<script lang="ts">
  import { getContext } from "svelte";
  import { Input } from "$lib/components/ui/input";
  import ClickableTitle from "./clickable-title.svelte";
  import { getEditModeContext, type UserRole } from "./edit-mode.svelte.js";
  import EditableCellWrapper from "./editable-cell-wrapper.svelte";

  interface Props {
    rowId: string;
    field: "title";
    value: string;
    placeholder?: string;
    required?: boolean;
    class?: string;
  }

  let { rowId, field, value, placeholder = "", required = false, class: className = "" }: Props = $props();

  const editMode = getEditModeContext();
  const editOptions = getContext<{ userRole: () => UserRole }>("editOptions");

  // Check if user can edit this field
  const canEdit = $derived(editMode.canEditField(editOptions.userRole(), field));

  // Get the current value (edited or original)
  const currentValue = $derived(editMode.getEditedValue(rowId, field) ?? value);

  // Debounce timer for validation
  let validationTimer: ReturnType<typeof setTimeout> | null = null;

  function handleInput(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    const newValue = target.value;

    // Mark field as edited
    editMode.markFieldEdited(rowId, field, newValue, value);

    // Clear previous validation timer
    if (validationTimer) {
      clearTimeout(validationTimer);
    }

    // Validate after debounce
    validationTimer = setTimeout(() => {
      validateField(newValue);
    }, 300);
  }

  async function validateField(newValue: string) {
    // Required validation
    if (required && !newValue.trim()) {
      editMode.setValidationError(rowId, field, "This field is required");
      return;
    }

    // Title uniqueness validation (debounced API call)
    if (field === "title" && newValue.trim()) {
      try {
        const response = await fetch(`/api/watchlist/validate-title?title=${encodeURIComponent(newValue)}&excludeId=${rowId}`);
        const result = await response.json();

        if (!result.isUnique) {
          editMode.setValidationError(rowId, field, "A watch item with this title already exists");
          return;
        }
      } catch (error) {
        // Ignore validation errors on network issues
        console.error("Validation error:", error);
      }
    }

    // Clear error if validation passes
    editMode.clearValidationError(rowId, field);
  }

  // Cleanup on component destroy
  $effect(() => {
    return () => {
      if (validationTimer) {
        clearTimeout(validationTimer);
      }
    };
  });
</script>

<EditableCellWrapper {rowId} {field} {canEdit} class={className}>
  {#if editMode.isEditMode && canEdit}
    <Input type="text" value={currentValue} oninput={handleInput} {placeholder} class="min-w-[150px] px-4 text-sm" />
  {:else if field === "title"}
    <ClickableTitle title={currentValue ?? ""} />
  {:else}
    <span class="font-medium truncate" title={currentValue ?? ""}>{currentValue || "-"}</span>
  {/if}
</EditableCellWrapper>
