<script lang="ts">
  import XIcon from "@lucide/svelte/icons/x";
  import { MAX_CUSTOM_TAGS_PER_ADD, parseCustomTagNames } from "$lib/custom-tags";

  let {
    tags = $bindable<string[]>([]),
    draft = $bindable(""),
    name = "customTags",
    placeholder = "New custom tags — Enter or comma to add",
    disabled = false,
  }: {
    tags?: string[];
    /** Uncommitted text; parents should include it on submit (see `withDraft`). */
    draft?: string;
    name?: string;
    placeholder?: string;
    disabled?: boolean;
  } = $props();

  let inputEl = $state<HTMLInputElement | null>(null);

  const atLimit = $derived(tags.length >= MAX_CUSTOM_TAGS_PER_ADD);

  function commit(raw = draft) {
    if (!raw.trim()) {
      draft = "";
      return;
    }
    tags = parseCustomTagNames([...tags, raw]);
    draft = "";
  }

  function remove(tag: string) {
    tags = tags.filter((t) => t !== tag);
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !draft && tags.length > 0) {
      tags = tags.slice(0, -1);
    }
  }

  function onInput() {
    if (draft.includes(",")) commit();
  }

  function onPaste(e: ClipboardEvent) {
    const text = e.clipboardData?.getData("text") ?? "";
    if (!text.includes(",") && !text.includes("\n")) return;
    e.preventDefault();
    commit(`${draft},${text.replace(/\n/g, ",")}`);
  }
</script>

<!-- Clicking the padded field focuses the text input; keyboard users reach the input directly. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
  class="auth-field flex min-h-[2.375rem] w-full cursor-text flex-wrap items-center gap-1 {disabled ? 'pointer-events-none opacity-50' : ''}"
  onclick={() => inputEl?.focus()}
>
  {#if draft.trim()}
    <input type="hidden" {name} value={draft} />
  {/if}
  {#each tags as tag (tag)}
    <input type="hidden" {name} value={tag} />
    <span class="inline-flex items-center gap-1 rounded-full border border-signal/40 bg-signal/10 py-0.5 pr-1 pl-2 font-mono text-[10px] text-signal">
      {tag}
      <button
        type="button"
        class="rounded-full p-0.5 text-signal/70 hover:bg-signal/20 hover:text-signal"
        aria-label={`Remove ${tag}`}
        {disabled}
        onclick={(e) => {
          e.stopPropagation();
          remove(tag);
        }}
      >
        <XIcon class="size-3" />
      </button>
    </span>
  {/each}
  <input
    bind:this={inputEl}
    bind:value={draft}
    class="min-w-[8rem] flex-1 border-0 bg-transparent p-0 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:ring-0 focus:outline-none"
    type="text"
    aria-label="Add custom tags"
    placeholder={atLimit ? `Max ${MAX_CUSTOM_TAGS_PER_ADD} tags` : tags.length ? "Add another…" : placeholder}
    maxlength={64}
    disabled={disabled || atLimit}
    onkeydown={onKeydown}
    oninput={onInput}
    onpaste={onPaste}
    onblur={() => commit()}
  />
</div>
