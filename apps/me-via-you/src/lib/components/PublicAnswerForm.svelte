<script lang="ts">
  import { enhance } from "$app/forms";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Switch } from "$lib/components/ui/switch";
  import { Textarea } from "$lib/components/ui/textarea";
  import OptionalFieldSection from "$lib/components/OptionalFieldSection.svelte";
  import { countWords, PRIMARY_ANSWER_MAX_WORDS, PRIMARY_ANSWER_TARGET_WORDS } from "$lib/word-count";

  type Props = {
    question: string;
    closed: boolean;
    form?: HTMLFormElement;
  };

  let { question, closed, form = $bindable() }: Props = $props();

  let primaryAnswer = $state("");
  let respondentName = $state("");
  let isAnonymous = $state(false);
  let expandDetail = $state("");
  let notes = $state("");
  let showExpand = $state(false);
  let showNotes = $state(false);
  let submitted = $state(false);
  let error = $state("");
  let submitting = $state(false);

  const wordCount = $derived(countWords(primaryAnswer));
  const overTarget = $derived(wordCount > PRIMARY_ANSWER_TARGET_WORDS);
  const overMax = $derived(wordCount > PRIMARY_ANSWER_MAX_WORDS);
  const canSubmit = $derived(!closed && !overMax && primaryAnswer.trim().length > 0 && !submitting);

  function resetForm() {
    primaryAnswer = "";
    respondentName = "";
    isAnonymous = false;
    expandDetail = "";
    notes = "";
    showExpand = false;
    showNotes = false;
    submitted = false;
    error = "";
  }
</script>

<div class="space-y-8">
  <header class="space-y-3 text-center">
    <p class="text-xs uppercase tracking-[0.2em] text-accent">Answer for a cookie</p>
    <h1 class="text-2xl font-semibold leading-snug text-foreground">{question}</h1>
  </header>

  {#if closed}
    <div class="rounded-lg border border-border bg-background/60 px-4 py-6 text-center">
      <p class="text-foreground">This form is closed.</p>
      <p class="mt-2 text-sm text-muted-foreground">Thanks for stopping by — responses are no longer being collected.</p>
    </div>
  {:else if submitted}
    <div class="space-y-4 rounded-lg border border-accent/30 bg-accent/5 px-4 py-6 text-center">
      <p class="text-lg text-foreground">Thank you — your answer was sent.</p>
      <p class="text-sm text-muted-foreground">Have another thought? You can add as many answers as you like.</p>
      <Button type="button" variant="outline" onclick={resetForm}>Add another answer</Button>
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
          if (result.type === "success") {
            submitted = true;
            await update({ reset: false });
          }
        };
      }}
    >
      <div class="grid gap-2">
        <Label for="primaryAnswer">Your answer</Label>
        <Input
          id="primaryAnswer"
          name="primaryAnswer"
          type="text"
          bind:value={primaryAnswer}
          placeholder="Keep it short and honest"
          autocomplete="off"
          required
        />
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

      <OptionalFieldSection bind:open={showExpand} title="Expand" hint="Use this if 3 words were not enough :)">
        <Textarea id="expandDetail" name="expandDetail" rows={4} bind:value={expandDetail} placeholder="Tell them more about your answer…" />
      </OptionalFieldSection>

      <OptionalFieldSection bind:open={showNotes} title="Notes" hint="Leave a note for your person!">
        <Textarea id="notes" name="notes" rows={3} bind:value={notes} placeholder="Share anything else on your mind…" />
      </OptionalFieldSection>

      {#if error}
        <p class="auth-error">{error}</p>
      {/if}

      <Button type="submit" class="w-full" disabled={!canSubmit}>
        {submitting ? "Sending…" : "Submit answer"}
      </Button>
    </form>
  {/if}
</div>
