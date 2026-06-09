<script lang="ts">
  import { enhance } from "$app/forms";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Switch } from "$lib/components/ui/switch";
  import { Textarea } from "$lib/components/ui/textarea";
  import OptionalFieldSection from "$lib/components/OptionalFieldSection.svelte";
  import { MAX_ANSWERS_PER_SUBMIT, type AnswerDraft, type PublicUserProfile } from "$lib/form-utils";
  import { userHomePath } from "$lib/paths";
  import { countWords, PRIMARY_ANSWER_MAX_WORDS, PRIMARY_ANSWER_TARGET_WORDS } from "$lib/word-count";
  import { Plus, X } from "@lucide/svelte";

  type Props = {
    question: string;
    owner: PublicUserProfile;
    closed: boolean;
    form?: HTMLFormElement;
  };

  let { question, owner, closed, form = $bindable() }: Props = $props();

  let primaryAnswer = $state("");
  let respondentName = $state("");
  let isAnonymous = $state(false);
  let expandDetail = $state("");
  let notes = $state("");
  let showExpand = $state(false);
  let showNotes = $state(false);
  let drafts = $state<AnswerDraft[]>([]);
  let error = $state("");
  let submitting = $state(false);

  const wordCount = $derived(countWords(primaryAnswer));
  const overTarget = $derived(wordCount > PRIMARY_ANSWER_TARGET_WORDS);
  const overMax = $derived(wordCount > PRIMARY_ANSWER_MAX_WORDS);
  const currentValid = $derived(!overMax && primaryAnswer.trim().length > 0);
  const atAnswerLimit = $derived(submitCount >= MAX_ANSWERS_PER_SUBMIT);
  const canAddAnother = $derived(!closed && currentValid && !submitting && drafts.length < MAX_ANSWERS_PER_SUBMIT - 1);
  const answersToSubmit = $derived.by(() => {
    const answers = [...drafts];
    if (primaryAnswer.trim()) {
      answers.push({
        primaryAnswer,
        expandDetail: expandDetail.trim() || null,
        notes: notes.trim() || null,
      });
    }
    return answers;
  });
  const submitCount = $derived(answersToSubmit.length);
  const canSubmit = $derived(
    !closed &&
      !submitting &&
      submitCount > 0 &&
      submitCount <= MAX_ANSWERS_PER_SUBMIT &&
      answersToSubmit.every((answer) => {
        const words = countWords(answer.primaryAnswer);
        return words > 0 && words <= PRIMARY_ANSWER_MAX_WORDS;
      })
  );
  const answersJson = $derived(JSON.stringify(answersToSubmit));

  function clearCurrentAnswer() {
    primaryAnswer = "";
    expandDetail = "";
    notes = "";
    showExpand = false;
    showNotes = false;
  }

  function addAnotherAnswer() {
    if (!currentValid || drafts.length >= MAX_ANSWERS_PER_SUBMIT - 1) return;

    drafts = [
      ...drafts,
      {
        primaryAnswer: primaryAnswer.trim(),
        expandDetail: expandDetail.trim() || null,
        notes: notes.trim() || null,
      },
    ];
    clearCurrentAnswer();
    error = "";
  }

  function removeDraft(index: number) {
    drafts = drafts.filter((_, i) => i !== index);
  }
</script>

<div class="space-y-8">
  <header class="space-y-3 text-center">
    <p class="text-xs uppercase tracking-[0.2em] text-accent">Answer for a cookie</p>
    <p class="text-base text-muted-foreground">
      For
      <a
        href={userHomePath(owner.username)}
        class="inline-flex flex-wrap items-baseline justify-center gap-x-1.5 font-semibold text-primary hover:underline"
      >
        <span class="text-lg">{owner.displayName}</span>
        <span class="text-base">@{owner.username}</span>
      </a>
    </p>
    <h1 class="text-2xl font-semibold leading-snug text-foreground">{question}</h1>
  </header>

  {#if closed}
    <div class="rounded-lg border border-border bg-background/60 px-4 py-6 text-center">
      <p class="text-foreground">This form is closed.</p>
      <p class="mt-2 text-sm text-muted-foreground">Thanks for stopping by — responses are no longer being collected.</p>
    </div>
  {:else}
    <form
      bind:this={form}
      method="POST"
      action="?/submit"
      class="space-y-6"
      use:enhance={() => {
        submitting = true;
        error = "";
        return async ({ result, update }) => {
          submitting = false;
          if (result.type === "failure") {
            error = (result.data?.error as string) ?? "Something went wrong. Please try again.";
            return;
          }
          await update();
        };
      }}
    >
      <div class="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        <p>
          <span class="font-medium text-foreground">Public:</span>
          your answer, name, and expand details will be visible on
          <span class="font-medium text-primary">{owner.displayName}</span>'s profile. Notes stay private.
        </p>
      </div>

      {#if drafts.length > 0}
        <div class="space-y-2">
          <p class="text-sm font-medium text-foreground">
            {drafts.length}
            {drafts.length === 1 ? "answer" : "answers"} ready to send
            <span class="font-normal text-muted-foreground">({submitCount} / {MAX_ANSWERS_PER_SUBMIT} max)</span>
          </p>
          <ul class="space-y-2">
            {#each drafts as draft, index (index)}
              <li class="flex items-start gap-3 rounded-lg border border-border bg-background/40 px-3 py-2">
                <div class="min-w-0 flex-1">
                  <p class="text-sm text-foreground">{draft.primaryAnswer}</p>
                  {#if draft.expandDetail}
                    <p class="mt-1 text-xs text-muted-foreground">Expand: {draft.expandDetail}</p>
                  {/if}
                  {#if draft.notes}
                    <p class="mt-1 text-xs text-muted-foreground">Notes: {draft.notes}</p>
                  {/if}
                </div>
                <button
                  type="button"
                  class="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                  onclick={() => removeDraft(index)}
                  aria-label="Remove answer {index + 1}"
                >
                  <X class="size-4" />
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      <div class="grid gap-2">
        <Label for="primaryAnswer">
          {drafts.length > 0 ? "Another answer" : "Your answer"}
        </Label>
        <p class="text-xs text-muted-foreground">Public — shown on their profile.</p>
        <Input id="primaryAnswer" type="text" bind:value={primaryAnswer} placeholder="Keep it short and honest" autocomplete="off" />
        <div class="flex items-center justify-between text-xs">
          <span class="text-muted-foreground">{wordCount} / {PRIMARY_ANSWER_MAX_WORDS} words</span>
          {#if overTarget && !overMax}
            <span class="text-accent">Three words is perfect — but a few more is okay too.</span>
          {/if}
          {#if overMax}
            <span class="text-destructive">Please trim to {PRIMARY_ANSWER_MAX_WORDS} words or fewer.</span>
          {/if}
        </div>
      </div>

      <div class="grid gap-2">
        <Label for="respondentName">Your name (optional)</Label>
        <p class="text-xs text-muted-foreground">Public — unless you stay anonymous.</p>
        <Input
          id="respondentName"
          name="respondentName"
          type="text"
          bind:value={respondentName}
          placeholder="How should they know you?"
          disabled={isAnonymous}
        />
        <div class="flex items-center gap-3">
          <Switch
            id="isAnonymous"
            bind:checked={isAnonymous}
            onCheckedChange={(checked) => {
              if (checked) respondentName = "";
            }}
          />
          <Label for="isAnonymous" class="font-normal text-muted-foreground">Stay anonymous</Label>
        </div>
        <input type="hidden" name="isAnonymous" value={isAnonymous ? "true" : "false"} />
      </div>

      <OptionalFieldSection bind:open={showExpand} title="Expand" hint="Use this if 3 words were not enough :) — public on their profile">
        <Textarea id="expandDetail" rows={4} bind:value={expandDetail} placeholder="Tell them more about your answer…" />
      </OptionalFieldSection>

      <OptionalFieldSection bind:open={showNotes} title="Notes" hint="Leave a private note for your person! <3">
        <Textarea id="notes" rows={3} bind:value={notes} placeholder="Share anything else on your mind…" />
      </OptionalFieldSection>

      <input type="hidden" name="answers" value={answersJson} />

      {#if atAnswerLimit && !error}
        <p class="text-sm text-muted-foreground">You've reached the maximum of {MAX_ANSWERS_PER_SUBMIT} answers for this submission.</p>
      {/if}

      {#if error}
        <p class="auth-error">{error}</p>
      {/if}

      <div class="flex flex-col gap-3 sm:flex-row">
        <Button type="button" variant="outline" class="sm:flex-1" disabled={!canAddAnother} onclick={addAnotherAnswer}>
          <Plus class="size-4" />
          Add another answer
        </Button>
        <Button type="submit" class="sm:flex-1" disabled={!canSubmit}>
          {submitting ? "Sending…" : submitCount === 1 ? "Submit answer" : `Submit ${submitCount} answers`}
        </Button>
      </div>
    </form>
  {/if}
</div>
