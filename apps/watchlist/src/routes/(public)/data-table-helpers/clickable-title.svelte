<script lang="ts">
import { getContext } from "svelte";

type Props = {
  title: string;
};

let { title }: Props = $props();

const searchContext = getContext<{
  updateSearchQuery: (query: string) => void;
  currentSearchQuery: () => string;
}>("searchContext");

// Split title into segments (words and separators) to preserve formatting
const segments = $derived.by(() => {
  if (!title) return [];
  // Match sequences of alphanumeric characters (words) and everything else (separators)
  const regex = /([a-zA-Z0-9]+)|([^a-zA-Z0-9]+)/g;
  const matches = title.matchAll(regex);
  return Array.from(matches, (match) => ({
    text: match[0],
    isWord: match[1] !== undefined, // First capture group is word
  }));
});

function handleWordClick(word: string) {
  if (!searchContext) return;
  // Only trigger if word is 3+ letters
  if (word.length >= 3) {
    const currentQuery = searchContext.currentSearchQuery();
    // Toggle: if word matches current search, clear it; otherwise set it
    if (currentQuery === word) {
      searchContext.updateSearchQuery("");
    } else {
      searchContext.updateSearchQuery(word);
    }
  }
}

function isClickable(segment: { text: string; isWord: boolean }): boolean {
  return segment.isWord && segment.text.length >= 3;
}
</script>

{#if title}
  <span class="font-medium truncate" {title}>
    {#each segments as segment}
      {#if isClickable(segment)}
        <span
          class="cursor-pointer hover:underline"
          onclick={() => handleWordClick(segment.text)}
          role="button"
          tabindex="0"
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleWordClick(segment.text);
            }
          }}
        >
          {segment.text}
        </span>
      {:else}
        <span>{segment.text}</span>
      {/if}
    {/each}
  </span>
{:else}
  <span>-</span>
{/if}
