<script lang="ts">
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import { page } from "$app/state";
  import PageHeader from "$lib/components/PageHeader.svelte";
</script>

<section class="zap-page">
  <PageHeader title={page.status === 403 ? "Not allowed" : page.status === 404 ? "Not found" : "Error"}>
    {#snippet meta()}
      {page.status}
    {/snippet}
    {#snippet actions()}
      <a href="/home" class="auth-btn inline-flex items-center gap-1.5">
        <ArrowLeftIcon class="size-3.5" aria-hidden="true" />
        Home
      </a>
    {/snippet}
  </PageHeader>
  <p class="text-sm text-muted-foreground">{page.error?.message ?? "Unexpected error."}</p>
</section>
