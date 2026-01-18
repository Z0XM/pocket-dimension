<script lang="ts">
  import { ChevronDownIcon } from "@lucide/svelte";
  import { getContext } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import {
    type EditableFields,
    getEditModeContext,
    type UserRole,
  } from "./edit-mode.svelte.js";
  import EditableCellWrapper from "./editable-cell-wrapper.svelte";

  type SelectableField = "languageId" | "type" | "my_progress_status";

  interface SelectOption {
    value: string;
    label: string;
  }

  interface Props {
    rowId: string;
    field: SelectableField;
    value: string | null;
    displayValue?: string | null;
    options: SelectOption[];
    placeholder?: string;
    required?: boolean;
    filterType?: "language" | "type" | "progress";
    class?: string;
  }

  let {
    rowId,
    field,
    value,
    displayValue,
    options: propOptions,
    placeholder = "Select...",
    required = false,
    filterType,
    class: className = "",
  }: Props = $props();

  const editMode = getEditModeContext();
  const editOptions = getContext<{
    userRole: () => UserRole;
    languages: () => Array<{ id: string; language: string }>;
    types: () => string[];
  }>("editOptions");
  const filterContext = getContext<
    { addFilterValue: (type: string, value: string) => void } | undefined
  >("filterContext");

  // Get options - for language field, get from context; otherwise use props
  const options = $derived.by(() => {
    if (field === "languageId") {
      return editOptions.languages().map((l) => ({
        value: l.id,
        label: l.language,
      }));
    }
    if (field === "type") {
      return editOptions.types().map((t) => ({
        value: t,
        label: t.charAt(0).toUpperCase() + t.slice(1),
      }));
    }

    return propOptions;
  });

  // Check if user can edit this field based on their role
  const canEdit = $derived(
    editMode.canEditField(editOptions.userRole(), field),
  );

  // Get the current value (edited or original)
  // Use undefined check to distinguish between "not edited" and "edited to null"
  const currentValue = $derived.by(() => {
    const editedValue = editMode.getEditedValue(rowId, field);
    return editedValue !== undefined ? editedValue : value;
  });

  // Get display label for the current value
  const currentLabel = $derived.by(() => {
    if (!currentValue) return null;
    const option = options.find((opt) => opt.value === currentValue);
    return option?.label ?? displayValue ?? currentValue;
  });

  function handleSelect(selectedValue: string | undefined) {
    if (selectedValue === undefined) return;

    // Mark field as edited (allow empty string for non-required fields)
    const valueToSave = selectedValue === "" ? null : selectedValue;
    editMode.markFieldEdited(
      rowId,
      field,
      valueToSave as EditableFields[typeof field],
      value as EditableFields[typeof field],
    );

    // If progress is being changed to something other than "watched" or "dropped", clear rating fields
    // Ratings are only allowed when progress is "watched" or "dropped"
    if (field === "my_progress_status") {
      const canHaveRating =
        valueToSave === "watched" || valueToSave === "dropped";
      if (!canHaveRating) {
        editMode.markFieldEdited(rowId, "my_rating", null, null);
        editMode.markFieldEdited(rowId, "my_infinity", false, null);
        editMode.markFieldEdited(rowId, "my_shitty", false, null);
        editMode.clearValidationError(rowId, "my_rating");
      }
    }

    // Validate required
    if (required && !selectedValue) {
      editMode.setValidationError(rowId, field, "This field is required");
    } else {
      editMode.clearValidationError(rowId, field);
    }
  }

  function handleClick() {
    // If not in edit mode and filterContext exists, add to filter

    if (!editMode.isEditMode && filterContext && filterType && currentValue) {
      filterContext.addFilterValue(filterType, currentValue);
    }
  }

  // Format progress status for display
  function formatProgressStatus(status: string | null): string {
    if (!status) return "Unmarked";
    return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
</script>

<EditableCellWrapper {rowId} {field} {canEdit} class={className}>
  {#if editMode.isEditMode && canEdit}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button
            variant="outline"
            {...props}
            class="min-w-[120px] py-2 px-4 text-xs justify-between"
          >
            <span
              class="truncate {currentValue === null ||
              currentValue === undefined ||
              currentValue === ''
                ? 'text-muted-foreground'
                : ''}"
            >
              {#if field === "my_progress_status"}
                {formatProgressStatus(currentLabel)}
              {:else}
                {currentLabel || placeholder}
              {/if}
            </span>
            <ChevronDownIcon class="size-4 shrink-0 opacity-50" />
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        class="bg-white/1 backdrop-blur-md min-w-[120px] max-h-48 overflow-y-auto"
        align="start"
      >
        <DropdownMenu.RadioGroup
          value={currentValue ?? ""}
          onValueChange={handleSelect}
        >
          {#each options as option (option.value)}
            <DropdownMenu.RadioItem value={option.value}>
              {option.label}
            </DropdownMenu.RadioItem>
          {/each}
          {#if !required}
            <DropdownMenu.Separator />
            <DropdownMenu.RadioItem value="">
              <span class="text-muted-foreground">Clear</span>
            </DropdownMenu.RadioItem>
          {/if}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {:else}
    <!-- biome-ignore lint/a11y/useKeyWithClickEvents: clickable cell for filtering -->
    {@const textColorMap = {
      my_progress_status: {
        watched: "text-green-400 font-bold",
        dropped: "text-rose-400 font-bold",
        watching: "text-yellow-300 font-bold",
        watch_later: "text-indigo-300 font-bold",
      },
      // type: {
      //   movie: "text-amber-500 font-bold",
      //   series: "text-pink-500 font-bold",
      //   shorts: "text-emerald-500 font-bold",
      // },
      languageId: {
        English: "text-blue-200",
        Japanese: "text-green-200",
        Hindi: "text-amber-200",
      },
    } as { [key: string]: { [key: string]: string } }}
    <span
      class="capitalize cursor-pointer hover:underline truncate {currentValue ===
      null
        ? 'text-muted-foreground'
        : ''} {textColorMap[field]?.[currentValue ?? ''] ?? ''}"
      onclick={handleClick}
      role={filterType ? "button" : undefined}
    >
      {#if field === "my_progress_status"}
        {formatProgressStatus(currentLabel)}
      {:else}
        {currentLabel || "-"}
      {/if}
    </span>
  {/if}
</EditableCellWrapper>
