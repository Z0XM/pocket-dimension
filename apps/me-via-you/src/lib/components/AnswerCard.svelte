<script lang="ts">
  import { censorText } from "$lib/censor";
  import type { AnswerRow } from "$lib/types";

  type Props = {
    answer: AnswerRow;
    compact?: boolean;
    showNotes?: boolean;
  };

  let { answer, compact = false, showNotes = true }: Props = $props();

  let expandOpen = $state(false);
  let noteOpen = $state(false);

  const respondent = $derived(answer.isAnonymous ? "Anonymous" : (answer.respondentName ?? "Anonymous"));

  function showExpand() {
    expandOpen = true;
    noteOpen = false;
  }

  function showNote() {
    noteOpen = true;
    expandOpen = false;
  }
</script>

<article class="flex items-start justify-between gap-3 rounded-lg border border-border bg-background/60 px-3 py-2.5 {compact ? 'text-sm' : ''}">
  <div class="min-w-0 flex-1">
    <p class="font-medium text-foreground">{censorText(answer.primaryAnswer)}</p>
    <p class="mt-0.5 text-xs text-muted-foreground">{respondent}</p>
  </div>

  {#if answer.expandDetail || (showNotes && answer.notes)}
    <div class="flex shrink-0 items-center gap-1">
      {#if answer.expandDetail}
        <div class="relative" onmouseenter={showExpand} onmouseleave={() => (expandOpen = false)}>
          <button
            type="button"
            class="rounded px-2 py-1 text-xs transition-colors {expandOpen
              ? 'bg-muted/30 text-foreground'
              : 'text-muted-foreground hover:bg-muted/20 hover:text-foreground'}"
            aria-label="View expanded answer"
            aria-expanded={expandOpen}
          >
            Expand
          </button>
          {#if expandOpen}
            <div class="absolute right-0 top-full z-30 pt-1">
              <div class="w-64 rounded-lg border border-border bg-popover p-2.5 text-xs leading-relaxed text-popover-foreground shadow-md">
                {censorText(answer.expandDetail)}
              </div>
            </div>
          {/if}
        </div>
      {/if}

      {#if showNotes && answer.notes}
        <div class="relative" onmouseenter={showNote} onmouseleave={() => (noteOpen = false)}>
          <button
            type="button"
            class="rounded px-2 py-1 text-xs transition-colors {noteOpen
              ? 'bg-muted/30 text-foreground'
              : 'text-muted-foreground hover:bg-muted/20 hover:text-foreground'}"
            aria-label="View note"
            aria-expanded={noteOpen}
          >
            Note
          </button>
          {#if noteOpen}
            <div class="absolute right-0 top-full z-30 pt-1">
              <div class="w-64 rounded-lg border border-border bg-popover p-2.5 text-xs leading-relaxed text-popover-foreground shadow-md">
                {censorText(answer.notes)}
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</article>
