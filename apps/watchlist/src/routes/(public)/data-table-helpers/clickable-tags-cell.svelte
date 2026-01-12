<script lang="ts">
import { getContext } from "svelte";

type Props = {
  tags: string;
};

let { tags }: Props = $props();

const filterContext = getContext<{
  addFilterValue: (filterType: "language" | "tags" | "progress" | "type", value: string) => void;
  filters: () => { language: string[]; tags: string[]; progress: string[]; type: string[] };
}>("filterContext");

// Split tags by comma and trim whitespace
const tagList = $derived.by(() => {
  if (!tags) return [];
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
});

function handleTagClick(tag: string) {
  if (!filterContext) return;
  filterContext.addFilterValue("tags", tag);
}
</script>

{#if tagList.length > 0}
  <div class="capitalize">
    {#each tagList as tag, index (tag + index)}
      <span
        class="cursor-pointer hover:underline"
        onclick={() => handleTagClick(tag)}
        role="button"
        tabindex="0"
        onkeydown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleTagClick(tag);
          }
        }}
      >
        {tag}
      </span>{#if index < tagList.length - 1}<span class="select-none">{', '}</span>{/if}
    {/each}
  </div>
{:else}
  <span></span>
{/if}
