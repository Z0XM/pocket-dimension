<script lang="ts">
  import RhymesShell from "$lib/components/RhymesShell.svelte";
  import type { PageData } from "./$types";

  const { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>rhymes</title>
  <meta name="description" content="Browse, filter, and read poems, articles, songs, and diaries inline." />
</svelte:head>

<RhymesShell
  rhymes={data.rhymes}
  creatorWorkspace={data.creatorWorkspace}
  creatorPieces={data.creatorPieces}
  user={data.user}
/>