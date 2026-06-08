<script lang="ts">
  import { goto } from "$app/navigation";
  import AnswerCard from "$lib/components/AnswerCard.svelte";
  import { classificationLabel } from "$lib/form-utils";
  import { userFormPath } from "$lib/paths";
  import type { FormWithPreview } from "$lib/types";
  import { Copy, Expand, Eye, EyeOff, Lock } from "@lucide/svelte";

  type Props = {
    forms: FormWithPreview[];
    origin: string;
    username: string;
    isOwner?: boolean;
    showNotes?: boolean;
  };

  let { forms, origin, username, isOwner = false, showNotes = false }: Props = $props();

  async function copyLink(slug: string) {
    await navigator.clipboard.writeText(`${origin}/f/${slug}`);
  }
</script>

<section class="space-y-4">
  <div>
    <h2 class="text-xs uppercase tracking-[0.2em] text-accent">{isOwner ? "Your forms" : "Forms"}</h2>
    <p class="mt-1 text-sm text-muted-foreground">
      {isOwner ? "See what people have said about you :)" : "Answers shared on this profile."}
    </p>
  </div>

  {#if forms.length === 0}
    <p class="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
      {isOwner ? "No forms yet. Create your first form to start collecting feedback." : "No public forms yet."}
    </p>
  {:else}
    <div class="space-y-3">
      {#each forms as form (form.id)}
        <details class="group rounded-lg border border-border bg-background/40 {form.hiddenFromPublic ? 'opacity-70' : ''}">
          <summary class="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-4 [&::-webkit-details-marker]:hidden">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide
                    {form.classification === 'positive'
                    ? 'bg-positive/15 text-positive'
                    : form.classification === 'negative'
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted/20 text-muted-foreground'}"
                >
                  {classificationLabel(form.classification)}
                </span>
                <span
                  class="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide
                    {form.status === 'active' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}"
                >
                  {form.status}
                </span>
                {#if isOwner && form.hiddenFromPublic}
                  <span class="rounded-full bg-muted/30 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"> Hidden </span>
                {/if}
              </div>
              <p class="mt-2 font-medium text-foreground">{form.question}</p>
              <p class="mt-1 text-xs text-muted-foreground">
                {form.answerCount}
                {form.answerCount === 1 ? "answer" : "answers"} ·
                {new Date(form.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div class="flex shrink-0 items-center gap-1">
              {#if isOwner}
                <form method="POST" action="?/toggleFormVisibility">
                  <input type="hidden" name="formId" value={form.id} />
                  <input type="hidden" name="hidden" value={form.hiddenFromPublic ? "false" : "true"} />
                  <button
                    type="submit"
                    class="rounded border border-border p-2 text-muted-foreground hover:border-accent/40 hover:bg-accent/10 hover:text-accent"
                    title={form.hiddenFromPublic ? "Show on public profile" : "Hide from public profile"}
                    aria-label={form.hiddenFromPublic ? "Show on public profile" : "Hide from public profile"}
                    onclick={(event) => event.stopPropagation()}
                  >
                    {#if form.hiddenFromPublic}
                      <EyeOff size={16} aria-hidden="true" />
                    {:else}
                      <Eye size={16} aria-hidden="true" />
                    {/if}
                  </button>
                </form>

                <button
                  type="button"
                  class="rounded border border-accent/30 p-2 text-accent hover:bg-accent/10"
                  title="Open full view"
                  onclick={(event) => {
                    event.preventDefault();
                    goto(userFormPath(username, form.id));
                  }}
                >
                  <Expand size={16} aria-hidden="true" />
                </button>
              {/if}
            </div>
          </summary>

          <div class="space-y-4 border-t border-border px-4 py-4">
            {#if form.previewAnswers.length === 0}
              <p class="text-sm text-muted-foreground">No answers yet.</p>
            {:else}
              <div class="space-y-3">
                {#each form.previewAnswers as answer (answer.id)}
                  <AnswerCard {answer} compact {showNotes} />
                {/each}
              </div>
            {/if}

            {#if isOwner}
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded border border-accent/40 px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
                  onclick={() => goto(userFormPath(username, form.id))}
                >
                  <Expand size={14} aria-hidden="true" />
                  View all answers
                </button>

                {#if form.status === "active"}
                  <button
                    type="button"
                    class="inline-flex items-center gap-2 rounded border border-accent/40 px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
                    onclick={() => copyLink(form.publicSlug)}
                  >
                    <Copy size={14} aria-hidden="true" />
                    Copy link
                  </button>

                  <form method="POST" action="?/closeForm">
                    <input type="hidden" name="formId" value={form.id} />
                    <button
                      type="submit"
                      class="inline-flex items-center gap-2 rounded border border-destructive/40 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                    >
                      <Lock size={14} aria-hidden="true" />
                      Close form
                    </button>
                  </form>
                {/if}
              </div>
            {/if}
          </div>
        </details>
      {/each}
    </div>
  {/if}
</section>
