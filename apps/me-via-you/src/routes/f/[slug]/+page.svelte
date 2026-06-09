<script lang="ts">
  import PublicAnswerForm from "$lib/components/PublicAnswerForm.svelte";
  import SiteHeader from "$lib/components/SiteHeader.svelte";

  const { data } = $props();
</script>

<svelte:head>
  <title>{data.form?.question ?? "Form"} · {data.owner?.displayName ?? "User"} · Me Via You</title>
</svelte:head>

<SiteHeader subtitle={data.owner ? `@${data.owner.username}` : undefined} currentUsername={data.owner?.username} viewer={data.user} />

<main class="mx-auto max-w-xl px-6 py-12">
  {#if data.form}
    <PublicAnswerForm question={data.form.question} owner={data.owner} closed={data.closed} />
  {:else}
    <div class="text-center">
      <h1 class="text-xl font-semibold text-foreground">Form not found</h1>
      <p class="mt-2 text-sm text-muted-foreground">This link may be invalid or expired.</p>
    </div>
  {/if}
</main>
