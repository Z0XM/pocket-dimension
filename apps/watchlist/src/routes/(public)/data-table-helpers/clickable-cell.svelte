<script lang="ts">
  import { getContext } from "svelte";

  type Props = {
    value: string | null;
    filterType: "language" | "tags" | "progress" | "type";
  };

  let { value, filterType }: Props = $props();

  const filterContext = getContext<{
    addFilterValue: (filterType: "language" | "tags" | "progress" | "type", value: string) => void;
    filters: () => { language: string[]; tags: string[]; progress: string[]; type: string[] };
  }>("filterContext");

  // For progress, null values should be treated as "Unmarked"
  const displayValue = $derived.by(() => {
    if (filterType === "progress" && value === null) {
      return "Unmarked";
    }
    return value;
  });

  const filterValue = $derived.by(() => {
    if (filterType === "progress" && value === null) {
      return "Unmarked";
    }
    return value ?? null;
  });

  const isUnmarked = $derived.by(() => {
    return filterType === "progress" && displayValue === "Unmarked";
  });

  function handleClick() {
    if (!filterContext) return;
    const val = filterValue;
    // filterValue can be null for non-progress columns, so we need to check
    if (val === null) return;
    filterContext.addFilterValue(filterType, val);
  }
</script>

{#if displayValue}
  <span
    class="cursor-pointer hover:underline capitalize {isUnmarked ? 'text-muted-foreground' : ''}"
    onclick={handleClick}
    role="button"
    tabindex="0"
    onkeydown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    }}
  >
    {displayValue}
  </span>
{:else}
  <span></span>
{/if}
