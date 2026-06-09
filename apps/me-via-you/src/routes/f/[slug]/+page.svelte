<script lang="ts">
  import PublicAnswerForm from "$lib/components/PublicAnswerForm.svelte";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";

  const { data } = $props();
</script>

<svelte:head>
  <title>{data.form?.question ?? "Form"} · {data.owner?.displayName ?? "User"} · Me Via You</title>
</svelte:head>

<main class="mx-auto min-h-svh max-w-xl px-6 py-12">
  <div class="mb-6 flex justify-end">
    <ThemeToggle />
  </div>
  {#if data.form}
    <PublicAnswerForm question={data.form.question} owner={data.owner} closed={data.closed} />
  {:else}
    <div class="text-center">
      <h1 class="text-xl font-semibold text-foreground">Form not found</h1>
      <p class="mt-2 text-sm text-muted-foreground">This link may be invalid or expired.</p>
    </div>
  {/if}
</main>
