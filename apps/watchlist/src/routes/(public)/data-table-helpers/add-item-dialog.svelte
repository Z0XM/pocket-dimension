<script lang="ts">
  import { PlusIcon, XIcon } from "@lucide/svelte";
  import { getContext } from "svelte";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { Input } from "$lib/components/ui/input";
  import * as Select from "$lib/components/ui/select";
  import type { UserRole } from "./edit-mode.svelte.js";

  interface Props {
    open?: boolean;
  }

  let { open = $bindable(false) }: Props = $props();

  const editOptions = getContext<{
    userRole: () => UserRole;
    languages: () => Array<{ id: string; language: string }>;
    types: () => string[];
    tags: () => string[];
  }>("editOptions");

  // Form state
  let title = $state("");
  let languageId = $state<string>("");
  let type = $state<string>("");
  let progressStatus = $state<string>("");
  let rating = $state<string>("");
  let infinity = $state(false);
  let shitty = $state(false);
  let selectedTags = $state<string[]>([]);

  // Tag input state
  let newTagInput = $state("");
  let isTagDropdownOpen = $state(false);

  // Loading state
  let isSaving = $state(false);

  // Validation errors
  let validationErrors = $state<Record<string, string>>({});

  // Language options
  const languageOptions = $derived(
    editOptions.languages().map((l) => ({
      value: l.id,
      label: l.language,
    })),
  );

  // Type options
  const typeOptions = $derived(
    editOptions.types().map((t) => ({
      value: t,
      label: t.charAt(0).toUpperCase() + t.slice(1),
    })),
  );

  // Progress options
  const progressOptions = [
    { value: "watch_later", label: "Watch Later" },
    { value: "watching", label: "Watching" },
    { value: "watched", label: "Watched" },
    { value: "dropped", label: "Dropped" },
  ];

  // Available tags for autocomplete (excluding selected tags)
  const availableTags = $derived.by(() => {
    const allTags = editOptions.tags();
    return allTags.filter((t) => !selectedTags.includes(t));
  });

  // Filtered tag suggestions
  const tagSuggestions = $derived.by(() => {
    if (!newTagInput.trim()) {
      return availableTags;
    }
    const search = newTagInput.toLowerCase();
    return availableTags.filter((t) => t.toLowerCase().includes(search));
  });

  // Check if rating fields should be enabled
  const canRate = $derived(
    progressStatus === "watched" || progressStatus === "dropped",
  );

  // Current rating mode
  const ratingMode = $derived.by(() => {
    return infinity ? "infinity" : shitty ? "shitty" : "rating";
  });

  // Reset form when dialog closes
  $effect(() => {
    if (!open) {
      title = "";
      languageId = "";
      type = "";
      progressStatus = "";
      rating = "";
      infinity = false;
      shitty = false;
      selectedTags = [];
      newTagInput = "";
      validationErrors = {};
    }
  });

  function validateForm(): boolean {
    const errors: Record<string, string> = {};

    if (!title.trim()) {
      errors.title = "Title is required";
    }

    if (!languageId) {
      errors.languageId = "Language is required";
    }

    if (!type) {
      errors.type = "Type is required";
    }

    // Validate rating if progress allows it
    if (canRate && ratingMode === "rating" && rating) {
      const numRating = parseFloat(rating);
      if (Number.isNaN(numRating) || numRating < 0 || numRating > 10) {
        errors.rating = "Rating must be between 0 and 10";
      }
    }

    // Validate rating if progress doesn't allow it but rating is set
    if (!canRate && (rating || infinity || shitty)) {
      errors.rating =
        "Ratings are only allowed when progress is 'Watched' or 'Dropped'";
    }

    validationErrors = errors;
    return Object.keys(errors).length === 0;
  }

  function handleAddTag(tag: string) {
    const trimmedTag = tag.trim();
    if (!trimmedTag) return;
    if (selectedTags.includes(trimmedTag)) return;

    selectedTags = [...selectedTags, trimmedTag];
    newTagInput = "";
    isTagDropdownOpen = false;
  }

  function handleRemoveTag(tag: string) {
    selectedTags = selectedTags.filter((t) => t !== tag);
  }

  function handleTagInputKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (tagSuggestions.length > 0 && newTagInput.trim()) {
        const match = tagSuggestions.find(
          (s) => s.toLowerCase() === newTagInput.toLowerCase(),
        );
        handleAddTag(match || newTagInput);
      } else if (newTagInput.trim()) {
        handleAddTag(newTagInput);
      }
    } else if (e.key === "Escape") {
      isTagDropdownOpen = false;
      newTagInput = "";
    }
  }

  function toggleInfinity() {
    if (ratingMode === "infinity") {
      infinity = false;
    } else {
      infinity = true;
      shitty = false;
      rating = "";
    }
  }

  function toggleShitty() {
    if (ratingMode === "shitty") {
      shitty = false;
    } else {
      shitty = true;
      infinity = false;
      rating = "";
    }
  }

  function handleRatingInput(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    let newValue = target.value;

    // Validate rating is between 0 and 10
    const numValue = parseFloat(newValue);
    if (!Number.isNaN(numValue)) {
      if (numValue < 0) newValue = "0";
      if (numValue > 10) newValue = "10";
    }

    rating = newValue;
    infinity = false;
    shitty = false;
  }

  // Clear rating when progress changes to non-rateable status
  $effect(() => {
    if (!canRate) {
      rating = "";
      infinity = false;
      shitty = false;
    }
  });

  async function handleSubmit() {
    if (!validateForm()) {
      toast.error("Please fix validation errors before saving.");
      return;
    }

    isSaving = true;

    try {
      const tempId = `temp-${Date.now()}`;
      const newItem = {
        tempId,
        title: title.trim(),
        languageId,
        type,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        rating:
          canRate && ratingMode === "rating" && rating
            ? parseFloat(rating)
            : undefined,
        infinity: canRate && ratingMode === "infinity" ? true : undefined,
        shitty: canRate && ratingMode === "shitty" ? true : undefined,
        progressStatus: progressStatus || undefined,
      };

      const response = await fetch("/api/watchlist/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [],
          newItems: [newItem],
          deleteIds: [],
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || "Failed to save item.");
        isSaving = false;
        return;
      }

      // Handle API validation errors
      if (result.errors && result.errors.length > 0) {
        for (const error of result.errors) {
          if (error.field) {
            validationErrors[error.field] = error.message;
          } else {
            toast.error(`Error: ${error.message}`);
          }
        }
        isSaving = false;
        return;
      }

      // Success
      const successCount =
        (result.results?.created?.length || 0) +
        (result.results?.updated?.length || 0);

      if (successCount > 0) {
        toast.success("Successfully added new watch item.");
        open = false;
        // Refresh the page to get updated data
        await goto(page.url.toString(), { invalidateAll: true });
      } else {
        toast.error("No changes were saved.");
        isSaving = false;
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("An unexpected error occurred while saving.");
      isSaving = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="">
    <Dialog.Header>
      <Dialog.Title>Add New Watch Item</Dialog.Title>
      <Dialog.Description>
        Fill in the details to add a new watch item to the list.
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4 py-4">
      <!-- Title -->
      <div class="space-y-2">
        <label for="title" class="text-xs font-medium">Title</label>
        <Input
          id="title"
          bind:value={title}
          placeholder="Enter title..."
          class="text-xs {validationErrors.title ? 'border-red-500' : ''}"
        />
        {#if validationErrors.title}
          <p class="text-xs text-red-500">{validationErrors.title}</p>
        {/if}
      </div>

      <!-- Language -->
      <div class="space-y-2">
        <label for="language" class="text-xs font-medium">Language</label>
        <Select.Root
          type="single"
          value={languageId}
          onValueChange={(v) => (languageId = v ?? "")}
        >
          <Select.Trigger
            id="language"
            class="w-full text-xs cursor-pointer {validationErrors.languageId
              ? 'border-red-500'
              : ''}"
          >
            {languageId
              ? languageOptions.find((o) => o.value === languageId)?.label
              : "Select language..."}
          </Select.Trigger>
          <Select.Content
            class="bg-white/1 backdrop-blur-md max-h-48 overflow-y-auto text-xs"
          >
            {#each languageOptions as option}
              <Select.Item class="text-xs" value={option.value}
                >{option.label}</Select.Item
              >
            {/each}
          </Select.Content>
        </Select.Root>
        {#if validationErrors.languageId}
          <p class="text-xs text-red-500">{validationErrors.languageId}</p>
        {/if}
      </div>

      <!-- Type -->
      <div class="space-y-2">
        <label for="type" class="text-xs font-medium">Type</label>
        <Select.Root
          type="single"
          value={type}
          onValueChange={(v) => (type = v ?? "")}
        >
          <Select.Trigger
            id="type"
            class="w-full text-xs cursor-pointer {validationErrors.type
              ? 'border-red-500'
              : ''}"
          >
            {type
              ? typeOptions.find((o) => o.value === type)?.label
              : "Select type..."}
          </Select.Trigger>
          <Select.Content
            class="bg-white/1 backdrop-blur-md max-h-48 overflow-y-auto text-xs"
          >
            {#each typeOptions as option}
              <Select.Item class="text-xs" value={option.value}
                >{option.label}</Select.Item
              >
            {/each}
          </Select.Content>
        </Select.Root>
        {#if validationErrors.type}
          <p class="text-xs text-red-500">{validationErrors.type}</p>
        {/if}
      </div>

      <!-- Tags -->
      <div class="space-y-2">
        <label class="text-xs font-medium">Tags</label>
        <div
          class="flex flex-wrap items-center gap-1 min-h-[2.5rem] p-2 border rounded-md"
        >
          {#each selectedTags as tag (tag)}
            <Badge variant="outline" class="rounded-full">
              <span class="text-xs">{tag}</span>
              <Button
                variant="ghost"
                size="sm"
                onclick={() => handleRemoveTag(tag)}
                class="h-4 w-4 p-0 ml-1"
                title="Remove tag"
              >
                <XIcon class="size-3" />
              </Button>
            </Badge>
          {/each}
          <DropdownMenu.Root
            open={isTagDropdownOpen}
            onOpenChange={(open) => {
              isTagDropdownOpen = open;
              if (!open) newTagInput = "";
            }}
          >
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Button
                  variant="ghost"
                  size="sm"
                  {...props}
                  class="h-6 w-6 p-0 rounded-full border-blue-500/30"
                  title="Add tag"
                >
                  <PlusIcon class="size-3" />
                </Button>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
              class="bg-white/1 backdrop-blur-md w-48"
              align="start"
            >
              <div class="">
                <Input
                  bind:value={newTagInput}
                  placeholder="Search or add tag..."
                  class="text-xs mb-2"
                  onkeydown={handleTagInputKeydown}
                  onfocus={() => (isTagDropdownOpen = true)}
                />
                <div class="max-h-32 overflow-y-auto">
                  {#if tagSuggestions.length === 0 && newTagInput.trim()}
                    <Button
                      variant="ghost"
                      class="w-full justify-start text-xs"
                      onclick={() => handleAddTag(newTagInput)}
                    >
                      <PlusIcon class="size-3 mr-2" />
                      Add "{newTagInput}"
                    </Button>
                  {/if}
                  {#each tagSuggestions as tag}
                    <Button
                      variant="ghost"
                      class="w-full justify-start text-xs cursor-pointer"
                      onclick={() => handleAddTag(tag)}
                    >
                      {tag}
                    </Button>
                  {/each}
                </div>
              </div>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      </div>

      <!-- Progress -->
      <div class="space-y-2">
        <label for="progress" class="text-xs font-medium">Progress</label>
        <Select.Root
          type="single"
          value={progressStatus}
          onValueChange={(v) => (progressStatus = v ?? "")}
        >
          <Select.Trigger id="progress" class="w-full text-xs cursor-pointer">
            {progressStatus
              ? progressOptions.find((o) => o.value === progressStatus)?.label
              : "Select progress..."}
          </Select.Trigger>
          <Select.Content
            class="bg-white/1 backdrop-blur-md max-h-48 overflow-y-auto text-xs"
          >
            {#each progressOptions as option}
              <Select.Item class="text-xs" value={option.value}>{option.label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>

      <!-- Rating (only when progress is watched or dropped) -->
      {#if canRate}
        <div class="space-y-2">
          <label class="text-xs font-medium">Rating</label>
          <div class="flex items-center gap-2">
            {#if ratingMode === "rating"}
              <Input
                type="number"
                min="0"
                max="10"
                step="0.5"
                bind:value={rating}
                oninput={handleRatingInput}
                placeholder="0-10"
                class="text-xs w-24 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none {validationErrors.rating
                  ? 'border-red-500'
                  : ''}"
              />
            {/if}
            <div class="flex gap-1">
              <Button
                variant={ratingMode === "infinity" ? "outline" : "ghost"}
                size="sm"
                onclick={toggleInfinity}
                class="h-8 w-8 p-0 text-base {ratingMode === 'infinity'
                  ? 'border-green-500/50'
                  : ''}"
                title="Mark as Infinity"
              >
                ♾️
              </Button>
              <Button
                variant={ratingMode === "shitty" ? "outline" : "ghost"}
                size="sm"
                onclick={toggleShitty}
                class="h-8 w-8 p-0 text-base {ratingMode === 'shitty'
                  ? 'border-green-500/50'
                  : ''}"
                title="Mark as Shitty"
              >
                💩
              </Button>
            </div>
          </div>
          {#if validationErrors.rating}
            <p class="text-xs text-red-500">{validationErrors.rating}</p>
          {/if}
        </div>
      {:else if progressStatus}
        <div class="text-xs text-muted-foreground">
          Set progress to "Watched" or "Dropped" to enable rating
        </div>
      {/if}
    </div>

    <Dialog.Footer>
      <Button
        variant="outline"
        onclick={() => (open = false)}
        disabled={isSaving}
      >
        Cancel
      </Button>
      <Button onclick={handleSubmit} disabled={isSaving}>
        {#if isSaving}
          <div
            class="size-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"
          ></div>
        {/if}
        Add Item
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
