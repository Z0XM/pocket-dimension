<script lang="ts">
  import { PlusIcon, XIcon } from "@lucide/svelte";
  import { getContext } from "svelte";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { Input } from "$lib/components/ui/input";
  import { getEditModeContext, type UserRole } from "./edit-mode.svelte.js";
  import EditableCellWrapper from "./editable-cell-wrapper.svelte";

  interface Props {
    rowId: string;
    tags: string; // comma-separated tags
    class?: string;
  }

  let { rowId, tags, class: className = "" }: Props = $props();

  const editMode = getEditModeContext();
  const editOptions = getContext<{
    userRole: () => UserRole;
    tags: () => string[];
  }>("editOptions");
  const filterContext = getContext<{ addFilterValue: (type: string, value: string) => void } | undefined>("filterContext");

  // Check if user can edit tags
  const canEdit = $derived(editMode.canEditField(editOptions.userRole(), "tags"));

  // Parse original tags
  const originalTags = $derived(
    tags
      ? tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : []
  );

  // Get added and deleted tags
  const addedTags = $derived(editMode.getAddedTags(rowId));
  const deletedTags = $derived(editMode.getDeletedTags(rowId));

  // Check if there are any tag changes for undo indicator
  const hasTagChanges = $derived(editMode.hasTagChanges(rowId));

  // Compute current visible tags
  const currentTags = $derived.by(() => {
    const visible = originalTags.filter((t) => !editMode.isTagDeleted(rowId, t));
    // Combine visible and added tags, removing duplicates
    const combined = [...visible, ...addedTags];
    return [...new Set(combined)];
  });

  // Available tags for autocomplete (excluding current tags)
  const availableTags = $derived.by(() => {
    const allTags = editOptions.tags();
    return allTags.filter((t) => !currentTags.includes(t));
  });

  // New tag input state
  let newTagInput = $state("");
  let isOpen = $state(false);

  // Filtered suggestions based on input
  const suggestions = $derived.by(() => {
    if (!newTagInput.trim()) {
      return availableTags;
    }
    const search = newTagInput.toLowerCase();
    return availableTags.filter((t) => t.toLowerCase().includes(search));
  });

  // Reset input when dropdown closes
  function handleOpenChange(open: boolean) {
    isOpen = open;
    if (!open) {
      newTagInput = "";
    }
  }

  function handleRemoveTag(tag: string) {
    const isNewTag = addedTags.includes(tag);
    editMode.removeTagFromRow(rowId, tag, isNewTag);
  }

  function handleAddTag(tag: string) {
    const trimmedTag = tag.trim();
    if (!trimmedTag) return;
    if (currentTags.includes(trimmedTag)) return;

    editMode.addTagToRow(rowId, trimmedTag);
    newTagInput = "";
    isOpen = false;
  }

  function handleInputKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions.length > 0 && newTagInput.trim()) {
        // Add first suggestion if it matches
        const match = suggestions.find((s) => s.toLowerCase() === newTagInput.toLowerCase());
        handleAddTag(match || newTagInput);
      } else if (newTagInput.trim()) {
        // Add as new tag
        handleAddTag(newTagInput);
      }
    } else if (e.key === "Escape") {
      isOpen = false;
      newTagInput = "";
    }
  }

  function handleTagClick(tag: string) {
    // Add to filter when clicking a tag (not in edit mode)
    if (!editMode.isEditMode && filterContext) {
      filterContext.addFilterValue("tags", tag);
    }
  }

  function handleUndoTags() {
    editMode.undoTagChanges(rowId);
  }
</script>

<EditableCellWrapper {rowId} field="tags" {canEdit} class={className} isEditedOverride={hasTagChanges} onUndo={handleUndoTags}>
  <div class="flex flex-wrap items-center gap-1">
    {#each currentTags as tag (tag)}
      {@const isNew = addedTags.includes(tag)}
      {#if editMode.isEditMode && canEdit}
        <Button variant="ghost" onclick={() => handleRemoveTag(tag)} class="rounded-full p-0.5" title="Remove tag">
          <Badge variant="outline" class={isNew ? "border-green-500/30  dark:hover:bg-green-950" : "border-rose-500/30  dark:hover:bg-rose-950"}>
            <span class="truncate max-w-[100px] leading-none">{tag}</span>
            <XIcon class="size-3" />
          </Badge>
        </Button>
      {:else}
        <Badge variant="outline" class="cursor-pointer border-violet-500/30  dark:hover:bg-violet-950" onclick={() => handleTagClick(tag)}>
          <span class="leading-none">{tag}</span>
        </Badge>
      {/if}
    {/each}

    {#if editMode.isEditMode && canEdit}
      <!-- Add tag dropdown -->
      <DropdownMenu.Root open={isOpen} onOpenChange={handleOpenChange}>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Button variant="ghost" size="sm" {...props} class="h-6 w-6 p-0 rounded-full border-blue-500/30  dark:hover:bg-blue-950" title="Add tag">
              <PlusIcon class="size-3" />
            </Button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content class="bg-white/1 backdrop-blur-md w-48" align="start">
          <div class="p-1">
            <Input type="text" bind:value={newTagInput} placeholder="Search or create tag..." class="text-xs w-full" onkeydown={handleInputKeydown} />
          </div>
          <div class="max-h-64 overflow-y-auto">
            {#each suggestions as suggestion (suggestion)}
              <DropdownMenu.Item class="truncate cursor-pointer" onSelect={() => handleAddTag(suggestion)}>
                {suggestion}
              </DropdownMenu.Item>
            {/each}
            {#if newTagInput.trim() && !suggestions.find((s) => s.toLowerCase() === newTagInput.toLowerCase())}
              <DropdownMenu.Item class="text-green-600 dark:text-green-400 cursor-pointer" onSelect={() => handleAddTag(newTagInput)}>
                Create "{newTagInput}"
              </DropdownMenu.Item>
            {/if}
            {#if suggestions.length === 0 && !newTagInput.trim()}
              <div class="px-2 py-1.5 text-xs text-muted-foreground">No tags available</div>
            {/if}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    {:else if currentTags.length === 0}
      <span class="text-muted-foreground">-</span>
    {/if}
  </div>
</EditableCellWrapper>
