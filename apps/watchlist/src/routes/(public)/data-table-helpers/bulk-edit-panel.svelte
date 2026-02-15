<script lang="ts">
  import { CheckIcon, PlusIcon, Trash2Icon, XIcon } from "@lucide/svelte";
  import { getContext } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import * as Select from "$lib/components/ui/select";
  import type { Watchlist } from "../columns";
  import { getEditModeContext, type UserRole } from "./edit-mode.svelte.js";

  interface Props {
    data: Watchlist[];
  }

  let { data }: Props = $props();

  const editMode = getEditModeContext();
  const editOptions = getContext<{
    userRole: () => UserRole;
    languages: () => Array<{ id: string; language: string }>;
    types: () => string[];
    progressStatuses: string[];
  }>("editOptions");

  const userRole = $derived(editOptions.userRole());
  const canDelete = $derived(editMode.canDeleteRows(userRole));
  // Only contributor and admin can edit contributor fields; "user" and "mobile" cannot
  const canEditContributorFields = $derived(userRole === "contributor" || userRole === "admin");

  const selectedCount = $derived(editMode.selectedCount);
  const isVisible = $derived(editMode.isEditMode && selectedCount > 0);

  // Bulk edit values
  let bulkLanguageId = $state<string>("");
  let bulkType = $state<string>("");
  let bulkProgress = $state<string>("");
  let bulkTag = $state("");

  // Language options
  const languageOptions = $derived(
    editOptions.languages().map((l) => ({
      value: l.id,
      label: l.language,
    }))
  );

  // Type options
  const typeOptions = $derived(
    editOptions.types().map((t) => ({
      value: t,
      label: t.charAt(0).toUpperCase() + t.slice(1),
    }))
  );

  // Progress options
  const progressOptions = $derived(
    editOptions.progressStatuses.map((p) => ({
      value: p,
      label: p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    }))
  );

  function applyBulkLanguage() {
    if (!bulkLanguageId) return;
    editMode.bulkEditField("languageId", bulkLanguageId, data);
    bulkLanguageId = "";
  }

  function applyBulkType() {
    if (!bulkType) return;
    editMode.bulkEditField("type", bulkType, data);
    bulkType = "";
  }

  function applyBulkProgress() {
    if (!bulkProgress) return;
    editMode.bulkEditField("my_progress_status", bulkProgress as any, data);
    bulkProgress = "";
  }

  function applyBulkTag() {
    if (!bulkTag.trim()) return;
    editMode.bulkAddTag(bulkTag.trim());
    bulkTag = "";
  }

  function handleBulkDelete() {
    editMode.bulkDeleteSelected();
  }

  function handleClearSelection() {
    editMode.clearSelection();
  }
</script>

{#if isVisible}
  <Card.Root class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 shadow-lg max-w-2xl w-[calc(100%-2rem)] px-4">
    <Card.Content class="px-2 py-1.5 flex flex-wrap items-end justify-between gap-2">
      <!-- Progress (all users can edit) -->
      <div class="flex flex-col gap-1 flex-1">
        <span class="text-[0.625rem] text-muted-foreground font-medium">Progress</span>
        <div class="flex items-center">
          <Select.Root type="single" value={bulkProgress} onValueChange={(v) => (bulkProgress = v ?? "")}>
            <Select.Trigger class="text-xs cursor-pointer">
              {bulkProgress ? progressOptions.find((o) => o.value === bulkProgress)?.label : "Select..."}
            </Select.Trigger>
            <Select.Content class="bg-white/1 backdrop-blur-md max-h-48 overflow-y-auto text-xs">
              {#each progressOptions as option (option.value)}
                <Select.Item class="text-xs" value={option.value}>{option.label}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
          {#if bulkProgress}
            <Button
              variant="ghost"
              size="icon"
              onclick={() => (bulkProgress = "")}
              class="ml-1 text-xs text-red-600 hover:text-red-700"
              title="Clear selection"
            >
              <XIcon class="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onclick={applyBulkProgress}
              disabled={!bulkProgress}
              class="text-xs text-green-600 hover:text-green-700"
              title="Apply"
            >
              <CheckIcon class="size-3.5" />
            </Button>
          {/if}
        </div>
      </div>

      {#if canEditContributorFields}
        <!-- Language -->
        <div class="flex flex-col gap-1 flex-1">
          <span class="text-[0.625rem] text-muted-foreground font-medium">Language</span>
          <div class="flex items-center">
            <Select.Root type="single" value={bulkLanguageId} onValueChange={(v) => (bulkLanguageId = v ?? "")}>
              <Select.Trigger class="text-xs cursor-pointer">
                {bulkLanguageId ? languageOptions.find((o) => o.value === bulkLanguageId)?.label : "Select..."}
              </Select.Trigger>
              <Select.Content class="bg-white/1 backdrop-blur-md max-h-48 overflow-y-auto text-xs">
                {#each languageOptions as option (option.value)}
                  <Select.Item class="text-xs" value={option.value}>{option.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
            {#if bulkLanguageId}
              <Button
                variant="ghost"
                size="icon"
                onclick={() => (bulkLanguageId = "")}
                class="ml-1 text-xs text-red-600 hover:text-red-700"
                title="Clear selection"
              >
                <XIcon class="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onclick={applyBulkLanguage}
                disabled={!bulkLanguageId}
                class="text-xs text-green-600 hover:text-green-700"
                title="Apply"
              >
                <CheckIcon class="size-4" />
              </Button>
            {/if}
          </div>
        </div>

        <!-- Type -->
        <div class="flex flex-col gap-1 flex-1">
          <span class="text-[0.625rem] text-muted-foreground font-medium">Type</span>
          <div class="flex items-center">
            <Select.Root type="single" value={bulkType} onValueChange={(v) => (bulkType = v ?? "")}>
              <Select.Trigger class="text-xs cursor-pointer">
                {bulkType ? typeOptions.find((o) => o.value === bulkType)?.label : "Select..."}
              </Select.Trigger>
              <Select.Content class="bg-white/1 backdrop-blur-md max-h-48 overflow-y-auto text-xs">
                {#each typeOptions as option (option.value)}
                  <Select.Item class="text-xs" value={option.value}>{option.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
            {#if bulkType}
              <Button
                variant="ghost"
                size="icon"
                onclick={() => (bulkType = "")}
                class="ml-1 text-xs text-red-600 hover:text-red-700"
                title="Clear selection"
              >
                <XIcon class="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onclick={applyBulkType}
                disabled={!bulkType}
                class="text-xs text-green-600 hover:text-green-700"
                title="Apply"
              >
                <CheckIcon class="size-3.5" />
              </Button>
            {/if}
          </div>
        </div>

        <!-- Add Tag -->
        <div class="flex flex-col gap-1 flex-1">
          <span class="text-[0.625rem] text-muted-foreground font-medium">Add Tag</span>
          <div class="flex items-center">
            <Input
              type="text"
              bind:value={bulkTag}
              placeholder="Enter tag..."
              class=" flex-1 text-xs"
              onkeydown={(e) => e.key === "Enter" && applyBulkTag()}
            />
            {#if bulkTag.trim()}
              <Button
                size="icon"
                variant="ghost"
                onclick={applyBulkTag}
                disabled={!bulkTag.trim()}
                class="ml-1 text-xs text-blue-600 hover:text-blue-700"
                title="Add tag"
              >
                <PlusIcon class="size-3.5" />
              </Button>
            {/if}
          </div>
        </div>
      {/if}
    </Card.Content>

    <!-- Footer: Row count and Actions -->
    <Card.Footer class="flex items-center justify-between px-2">
      <div class="flex items-center gap-1.5">
        <span class="text-xs font-medium">{selectedCount} row{selectedCount !== 1 ? "s" : ""} selected</span>
        <Button variant="ghost" size="sm" onclick={handleClearSelection} class="h-6 w-6 p-0 text-red-500" title="Clear selection">
          <XIcon class="size-3.5" />
        </Button>
      </div>
      {#if canDelete}
        <Button onclick={handleBulkDelete} class=" flex items-center py-2 gap-1 text-xs px-3 dark:hover:bg-rose-500 dark:bg-rose-800">
          <Trash2Icon class="size-3" />
          Delete Selected
        </Button>
      {/if}
    </Card.Footer>
  </Card.Root>
{/if}
