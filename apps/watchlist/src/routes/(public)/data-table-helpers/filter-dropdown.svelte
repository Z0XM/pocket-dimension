<script lang="ts">
import { CheckIcon, ListFilterIcon, XIcon } from "@lucide/svelte";
import { Button } from "$lib/components/ui/button";
import { Checkbox } from "$lib/components/ui/checkbox";
import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
import { Input } from "$lib/components/ui/input";

type Props = {
  options: string[];
  selectedValues: string[];
  onApply: (values: string[]) => void;
  placeholder?: string;
};

let { options, selectedValues, onApply, placeholder = "Search..." }: Props = $props();

let searchValue = $state("");
let tempSelected = $state<string[]>(selectedValues);
let isOpen = $state(false);
let dropdownContentRef: HTMLDivElement | null = $state(null);

// Filter options based on search input
let filteredOptions = $derived.by(() => {
  if (!searchValue.trim()) {
    return options;
  }
  const searchLower = searchValue.toLowerCase();
  return options.filter((opt) => opt.toLowerCase().includes(searchLower));
});

// Sync tempSelected with selectedValues when dropdown opens
$effect(() => {
  if (isOpen) {
    tempSelected = [...selectedValues];
    searchValue = "";
  }
});

// Handle Enter key on the entire dropdown content
$effect(() => {
  if (!isOpen || !dropdownContentRef) return;

  function handleKeyDown(e: KeyboardEvent) {
    // Only handle Enter if not typing in the input (input has its own handler)
    if (e.key === "Enter") {
      const target = e.target as HTMLElement;
      // If focus is on input, let the input handler deal with it
      if (target.tagName === "INPUT") {
        return;
      }
      // Otherwise, apply filters
      e.preventDefault();
      e.stopPropagation();
      handleApply();
    }
  }

  const content = dropdownContentRef;
  content.addEventListener("keydown", handleKeyDown);
  return () => {
    content.removeEventListener("keydown", handleKeyDown);
  };
});

function handleToggle(value: string) {
  if (tempSelected.includes(value)) {
    tempSelected = tempSelected.filter((v) => v !== value);
  } else {
    tempSelected = [...tempSelected, value];
  }
}

function handleApply() {
  onApply(tempSelected);
  isOpen = false;
}

function handleOpenChange(open: boolean) {
  isOpen = open;
  if (!open) {
    searchValue = "";
    tempSelected = [...selectedValues];
  }
}
</script>

<DropdownMenu.Root open={isOpen} onOpenChange={handleOpenChange}>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button
        variant="ghost"
        size="icon"
        {...props}
        class="relative p-0 m-0 hover:bg-accent rounded-full transition-colors"
        aria-label="Filter"
      >
        <ListFilterIcon class="size-3.5 {selectedValues.length > 0 ? 'text-primary' : ''}" />
        {#if selectedValues.length > 0}
          <span class="absolute top-0 right-0 size-1.5 rounded-full bg-primary"></span>
        {/if}
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content class="bg-white/1 backdrop-blur-md" align="end">
    <div bind:this={dropdownContentRef} class="space-y-1">
      <Input
        placeholder={placeholder}
        value={searchValue}
        oninput={(e) => {
          searchValue = (e.currentTarget as HTMLInputElement).value;
        }}
        onkeydown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleApply();
          }
        }}
        class="w-full"
      />
      <div class="max-h-64 overflow-y-auto space-y-1">
        {#if filteredOptions.length === 0}
          <div class="px-2 py-1 text-sm text-muted-foreground">No options found</div>
        {:else}
          {#each filteredOptions as option}
            {@const isChecked = tempSelected.includes(option)}
            <Button
              variant="ghost"
              class="px-4 flex items-center text-start gap-2 rounded-md w-full hover:bg-accent dark:hover:bg-accent cursor-pointer"
              onclick={() => handleToggle(option)}
            >
            <span class="text-xs flex-1 capitalize">{option}</span>
            {#if isChecked}
            <CheckIcon class="size-4" />
            {/if}
            </Button>
          {/each}
        {/if}
      </div>
      <div class="flex items-center justify-between pt-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          onclick={() => {
            tempSelected = [];
          }}
          class="text-xs"
        >
          Clear
        </Button>
        <Button size="sm" onclick={handleApply} class="text-xs">
          Apply
        </Button>
      </div>
    </div>
  </DropdownMenu.Content>
</DropdownMenu.Root>
