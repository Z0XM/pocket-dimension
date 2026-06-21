<script lang="ts">
  import RhymesShell from "$lib/components/RhymesShell.svelte";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{data.title} — rhymes</title>
  <meta name="description" content={data.description} />
</svelte:head>

<RhymesShell
  rhymes={data.rhymes}
  initialSlug={data.initialSlug}
  creatorWorkspace={data.creatorWorkspace}
  creatorPieces={data.creatorPieces}
  user={data.user}
/>
