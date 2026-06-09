<script lang="ts">
  import { goto } from "$app/navigation";
  import AnswerCard from "$lib/components/AnswerCard.svelte";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";
  import { classificationLabel } from "$lib/form-utils";
  import { userHomePath } from "$lib/paths";
  import { ArrowLeft, Copy, Lock } from "@lucide/svelte";

  const { data } = $props();

  const dashboardPath = $derived(userHomePath(data.username));

  async function copyLink() {
    if (!data.publicUrl) return;
    await navigator.clipboard.writeText(data.publicUrl);
  }
</script>

<svelte:head>
  <title>{data.form?.question ?? "Form"} · Me Via You</title>
</svelte:head>

{#if data.form}
  <header class="flex items-center justify-between border-b border-border px-6 py-4">
    <button type="button" class="inline-flex items-center gap-2 text-sm text-accent hover:underline" onclick={() => goto(dashboardPath)}>
      <ArrowLeft size={16} aria-hidden="true" />
      Back to dashboard
    </button>

    <div class="flex items-center gap-2">
      <ThemeToggle />

      {#if data.publicUrl}
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded border border-accent/40 px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
          onclick={copyLink}
        >
          <Copy size={14} aria-hidden="true" />
          Copy link
        </button>
      {/if}

      {#if data.form.status === "active"}
        <form method="POST" action="?/closeForm">
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
  </header>

  <main class="mx-auto max-w-3xl space-y-8 px-6 py-10">
    <section class="space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <span
          class="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide
            {data.form.classification === 'positive'
            ? 'bg-positive/15 text-positive'
            : data.form.classification === 'negative'
              ? 'bg-primary/15 text-primary'
              : 'bg-muted/20 text-muted-foreground'}"
        >
          {classificationLabel(data.form.classification)}
        </span>
        <span class="rounded-full bg-muted/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {data.form.status}
        </span>
      </div>

      <h1 class="text-3xl font-semibold leading-snug text-foreground">{data.form.question}</h1>

      <p class="text-sm text-muted-foreground">
        {data.answers.length}
        {data.answers.length === 1 ? "answer" : "answers"} · Created {new Date(data.form.createdAt).toLocaleDateString()}
      </p>

      {#if data.publicUrl}
        <p class="break-all font-mono text-xs text-accent">{data.publicUrl}</p>
      {/if}
    </section>

    <section class="space-y-4">
      {#if data.answers.length === 0}
        <p class="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No answers yet. Share the public link to start collecting responses.
        </p>
      {:else}
        {#each data.answers as answer (answer.id)}
          <AnswerCard {answer} />
        {/each}
      {/if}
    </section>
  </main>
{:else}
  <main class="mx-auto max-w-xl px-6 py-12 text-center">
    <h1 class="text-xl font-semibold text-foreground">Form not found</h1>
    <button type="button" class="mt-4 text-sm text-accent hover:underline" onclick={() => goto(dashboardPath)}> Back to dashboard </button>
  </main>
{/if}
