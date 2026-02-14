<script lang="ts">
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, XIcon } from "@lucide/svelte";
import { Button } from "$lib/components/ui/button";
import * as Dialog from "$lib/components/ui/dialog";
import { Input } from "$lib/components/ui/input";

interface Props {
  open?: boolean;
  languageOptions: string[];
  tagOptions: string[];
  typeOptions: string[];
  selectedLanguages: string[];
  selectedTags: string[];
  selectedTypes: string[];
  onApply: (filters: { language: string[]; tags: string[]; type: string[] }) => void;
}

let { open = $bindable(false), languageOptions, tagOptions, typeOptions, selectedLanguages, selectedTags, selectedTypes, onApply }: Props = $props();

// Temporary filter state
let tempLanguages = $state<string[]>([]);
let tempTags = $state<string[]>([]);
let tempTypes = $state<string[]>([]);

// Search states
let languageSearch = $state("");
let tagSearch = $state("");
let typeSearch = $state("");

// Collapsible states
let languageExpanded = $state(false);
let tagsExpanded = $state(false);
let typeExpanded = $state(false);

// Reset temp filters when dialog opens
$effect(() => {
  if (open) {
    tempLanguages = [...selectedLanguages];
    tempTags = [...selectedTags];
    tempTypes = [...selectedTypes];
    languageSearch = "";
    tagSearch = "";
    typeSearch = "";
    // Auto-expand sections that have selected values
    languageExpanded = selectedLanguages.length > 0;
    tagsExpanded = selectedTags.length > 0;
    typeExpanded = selectedTypes.length > 0;
  }
});

// Filtered options based on search
const filteredLanguages = $derived.by(() => {
  if (!languageSearch.trim()) return languageOptions;
  const search = languageSearch.toLowerCase();
  return languageOptions.filter((opt) => opt.toLowerCase().includes(search));
});

const filteredTags = $derived.by(() => {
  if (!tagSearch.trim()) return tagOptions;
  const search = tagSearch.toLowerCase();
  return tagOptions.filter((opt) => opt.toLowerCase().includes(search));
});

const filteredTypes = $derived.by(() => {
  if (!typeSearch.trim()) return typeOptions;
  const search = typeSearch.toLowerCase();
  return typeOptions.filter((opt) => opt.toLowerCase().includes(search));
});

function toggleLanguage(value: string) {
  if (tempLanguages.includes(value)) {
    tempLanguages = tempLanguages.filter((v) => v !== value);
  } else {
    tempLanguages = [...tempLanguages, value];
  }
}

function toggleTag(value: string) {
  if (tempTags.includes(value)) {
    tempTags = tempTags.filter((v) => v !== value);
  } else {
    tempTags = [...tempTags, value];
  }
}

function toggleType(value: string) {
  if (tempTypes.includes(value)) {
    tempTypes = tempTypes.filter((v) => v !== value);
  } else {
    tempTypes = [...tempTypes, value];
  }
}

function handleApply() {
  onApply({
    language: tempLanguages,
    tags: tempTags,
    type: tempTypes,
  });
  open = false;
}

function handleClear() {
  tempLanguages = [];
  tempTags = [];
  tempTypes = [];
}

function formatOption(option: string): string {
  if (!option) return option;
  if (option.includes("_")) {
    return option.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return option.charAt(0).toUpperCase() + option.slice(1);
}
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="max-w-sm max-h-[90vh] overflow-hidden flex flex-col">
    <Dialog.Header>
      <Dialog.Title>Filters</Dialog.Title>
      <Dialog.Description>
        Filter by language, tags, and type
      </Dialog.Description>
    </Dialog.Header>

    <div class="flex-1 overflow-y-auto space-y-4 py-4">
      <!-- Language Filter -->
      <div class="space-y-2">
        <Button
          variant="ghost"
          class="w-full justify-between p-0 h-auto"
          onclick={() => (languageExpanded = !languageExpanded)}
        >
          <span class="text-xs font-medium cursor-pointer">Language</span>
          {#if languageExpanded}
            <ChevronUpIcon class="size-4" />
          {:else}
            <ChevronDownIcon class="size-4" />
          {/if}
        </Button>
        {#if languageExpanded}
          <Input
            placeholder="Search languages..."
            bind:value={languageSearch}
            class="text-xs"
          />
          <div class="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
            {#if filteredLanguages.length === 0}
              <div class="px-2 py-1 text-xs text-muted-foreground">
                No options found
              </div>
            {:else}
              {#each filteredLanguages as option}
                {@const isChecked = tempLanguages.includes(option)}
                <Button
                  variant="ghost"
                  class="w-full justify-start text-xs h-8 px-2"
                  onclick={() => toggleLanguage(option)}
                >
                  <span class="flex-1 text-left">{option}</span>
                  {#if isChecked}
                    <CheckIcon class="size-4" />
                  {/if}
                </Button>
              {/each}
            {/if}
          </div>
        {/if}
        {#if tempLanguages.length > 0}
          <div class="flex flex-wrap gap-1">
            {#each tempLanguages as lang}
              <Button
                variant="outline"
                size="sm"
                onclick={() => toggleLanguage(lang)}
                class="h-5 text-xs rounded-full px-2"
              >
                {lang}
                <XIcon class="size-3 ml-1" />
              </Button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Tags Filter -->
      <div class="space-y-2">
        <Button
          variant="ghost"
          class="w-full justify-between p-0 h-auto"
          onclick={() => (tagsExpanded = !tagsExpanded)}
        >
          <span class="text-xs font-medium cursor-pointer">Tags</span>
          {#if tagsExpanded}
            <ChevronUpIcon class="size-4" />
          {:else}
            <ChevronDownIcon class="size-4" />
          {/if}
        </Button>
        {#if tagsExpanded}
          <Input
            placeholder="Search tags..."
            bind:value={tagSearch}
            class="text-xs"
          />
          <div class="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
            {#if filteredTags.length === 0}
              <div class="px-2 py-1 text-xs text-muted-foreground">
                No options found
              </div>
            {:else}
              {#each filteredTags as option}
                {@const isChecked = tempTags.includes(option)}
                <Button
                  variant="ghost"
                  class="w-full justify-start text-xs h-8 px-2"
                  onclick={() => toggleTag(option)}
                >
                  <span class="flex-1 text-left">{formatOption(option)}</span>
                  {#if isChecked}
                    <CheckIcon class="size-4" />
                  {/if}
                </Button>
              {/each}
            {/if}
          </div>
        {/if}
        {#if tempTags.length > 0}
          <div class="flex flex-wrap gap-1">
            {#each tempTags as tag}
              <Button
                variant="outline"
                size="sm"
                onclick={() => toggleTag(tag)}
                class="h-5 text-xs rounded-full px-2"
              >
                {formatOption(tag)}
                <XIcon class="size-3 ml-1" />
              </Button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Type Filter -->
      <div class="space-y-2">
        <Button
          variant="ghost"
          class="w-full justify-between p-0 h-auto"
          onclick={() => (typeExpanded = !typeExpanded)}
        >
          <span class="text-xs font-medium cursor-pointer">Type</span>
          {#if typeExpanded}
            <ChevronUpIcon class="size-4" />
          {:else}
            <ChevronDownIcon class="size-4" />
          {/if}
        </Button>
        {#if typeExpanded}
          <Input
            placeholder="Search types..."
            bind:value={typeSearch}
            class="text-xs"
          />
          <div class="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
            {#if filteredTypes.length === 0}
              <div class="px-2 py-1 text-xs text-muted-foreground">
                No options found
              </div>
            {:else}
              {#each filteredTypes as option}
                {@const isChecked = tempTypes.includes(option)}
                <Button
                  variant="ghost"
                  class="w-full justify-start text-xs h-8 px-2"
                  onclick={() => toggleType(option)}
                >
                  <span class="flex-1 text-left">{formatOption(option)}</span>
                  {#if isChecked}
                    <CheckIcon class="size-4" />
                  {/if}
                </Button>
              {/each}
            {/if}
          </div>
        {/if}
        {#if tempTypes.length > 0}
          <div class="flex flex-wrap gap-1">
            {#each tempTypes as type}
              <Button
                variant="outline"
                size="sm"
                onclick={() => toggleType(type)}
                class="h-5 text-xs rounded-full px-2"
              >
                {formatOption(type)}
                <XIcon class="size-3 ml-1" />
              </Button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <Dialog.Footer class="flex flex-row gap-2 items-center justify-center">
      <Button variant="outline" onclick={handleClear} class="text-xs">
        Clear All
      </Button>
      <Button variant="outline" onclick={() => (open = false)} class="text-xs">
        Cancel
      </Button>
      <Button onclick={handleApply} class="text-xs">Apply Filters</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
