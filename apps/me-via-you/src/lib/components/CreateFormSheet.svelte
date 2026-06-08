<script lang="ts">
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import DateTimePicker from "$lib/components/DateTimePicker.svelte";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import type { FormClassification } from "$lib/form-utils";
  import { CircleHelp, X } from "@lucide/svelte";

  type Props = {
    open: boolean;
    launchedUrl?: string | null;
    error?: string | null;
  };

  let { open = $bindable(), launchedUrl = $bindable(), error = $bindable() }: Props = $props();

  let question = $state("");
  let classification = $state<FormClassification>("positive");
  let closesAt = $state("");
  let submitting = $state(false);
  let classificationHelpOpen = $state(false);

  function closeSheet() {
    open = false;
    if (!launchedUrl) {
      question = "";
      classification = "positive";
      closesAt = "";
    }
  }

  async function copyUrl() {
    if (!launchedUrl) return;
    await navigator.clipboard.writeText(launchedUrl);
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
    <button type="button" class="absolute inset-0" aria-label="Close" onclick={closeSheet}></button>

    <div class="relative z-10 w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-xl">
      <div class="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 class="text-lg font-semibold text-foreground">
            {launchedUrl ? "Form launched" : "Create & launch form"}
          </h2>
          <p class="mt-1 text-sm text-muted-foreground">
            {launchedUrl
              ? "Share this link with anyone. They can respond without signing in."
              : "One question, one link — start collecting feedback."}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          class="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onclick={closeSheet}
          aria-label="Close"
        >
          <X size={16} aria-hidden="true" />
        </Button>
      </div>

      {#if launchedUrl}
        <div class="space-y-4">
          <div class="rounded-lg border border-accent/30 bg-accent/5 p-4">
            <p class="text-xs uppercase tracking-[0.15em] text-muted-foreground">Public link</p>
            <p class="mt-2 break-all font-mono text-sm text-foreground">{launchedUrl}</p>
          </div>
          <div class="flex gap-3">
            <Button type="button" class="flex-1" onclick={copyUrl}>Copy link</Button>
            <Button
              type="button"
              variant="outline"
              onclick={() => {
                launchedUrl = null;
                question = "";
                classification = "positive";
                closesAt = "";
              }}
            >
              Create another
            </Button>
          </div>
        </div>
      {:else}
        <form
          method="POST"
          action="?/createForm"
          class="space-y-5"
          use:enhance={() => {
            submitting = true;
            error = null;
            return async ({ result, update }) => {
              submitting = false;
              if (result.type === "failure") {
                error = (result.data?.error as string) ?? "Could not create form.";
                return;
              }
              if (result.type === "success" && result.data?.launchedUrl) {
                launchedUrl = result.data.launchedUrl as string;
                await invalidateAll();
              }
              await update();
            };
          }}
        >
          <div class="grid gap-2">
            <Label for="question">Question</Label>
            <Input id="question" name="question" type="text" bind:value={question} required placeholder="What do you want to ask?" />
          </div>

          <fieldset class="space-y-2">
            <legend class="flex items-center gap-1.5 text-sm font-medium text-foreground">
              Classification
              <span
                class="relative inline-flex"
                onmouseenter={() => (classificationHelpOpen = true)}
                onmouseleave={() => (classificationHelpOpen = false)}
              >
                <button
                  type="button"
                  class="inline-flex rounded-sm text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="What is classification?"
                  aria-expanded={classificationHelpOpen}
                >
                  <CircleHelp class="size-3.5" aria-hidden="true" />
                </button>
                {#if classificationHelpOpen}
                  <span class="absolute left-0 top-full z-30 block pt-1">
                    <span
                      class="block w-64 rounded-lg border border-border bg-popover p-2.5 text-xs leading-relaxed text-popover-foreground shadow-md"
                      role="tooltip"
                    >
                      What aspect of you will the answers indicate ? Positive or Negative ? Or Is it just a general question ?
                    </span>
                  </span>
                {/if}
              </span>
            </legend>
            <div class="flex flex-wrap gap-2">
              {#each ["positive", "negative", "general"] as value}
                <label class="cursor-pointer">
                  <input type="radio" name="classification" {value} bind:group={classification} class="peer sr-only" />
                  <span
                    class="inline-flex rounded-full border border-border px-3 py-1.5 text-sm capitalize text-muted-foreground peer-checked:text-foreground
                      {value === 'positive'
                      ? 'peer-checked:border-positive peer-checked:bg-positive/10'
                      : value === 'negative'
                        ? 'peer-checked:border-primary peer-checked:bg-primary/10'
                        : 'peer-checked:border-border peer-checked:bg-muted/30'}"
                  >
                    {value}
                  </span>
                </label>
              {/each}
            </div>
          </fieldset>

          <div class="grid gap-2">
            <Label for="closesAt">Close automatically at (optional)</Label>
            <DateTimePicker id="closesAt" name="closesAt" bind:value={closesAt} placeholder="No auto-close" />
          </div>

          {#if error}
            <p class="auth-error">{error}</p>
          {/if}

          <Button type="submit" class="w-full" disabled={submitting || !question.trim()}>
            {submitting ? "Launching…" : "Launch form"}
          </Button>
        </form>
      {/if}
    </div>
  </div>
{/if}
