<script lang="ts">
  import PublicAnswerForm from "$lib/components/PublicAnswerForm.svelte";

  const { data } = $props();
</script>

<svelte:head>
  <title>{data.form?.question ?? "Form"} · Me Via You</title>
</svelte:head>

<main class="mx-auto min-h-svh max-w-xl px-6 py-12">
  {#if data.form}
    <PublicAnswerForm question={data.form.question} closed={data.closed} />
  {:else}
    <div class="text-center">
      <h1 class="text-xl font-semibold text-foreground">Form not found</h1>
      <p class="mt-2 text-sm text-muted-foreground">This link may be invalid or expired.</p>
    </div>
  {/if}
</main>
