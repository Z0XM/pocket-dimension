<script lang="ts">
  import FilterSort from "$components/FilterSort.svelte";
  import QuickComposer from "$components/QuickComposer.svelte";
  import ExpandedEditor from "$components/ExpandedEditor.svelte";
  import RhymeSelector from "$components/RhymeSelector.svelte";
  import type { RhymesWorkspaceAccess } from "$lib/server/membership";
  import type { Rhyme } from "$lib/rhymes";

  interface CreatorPieceSummary {
    id: string;
    slug: string;
    title: string;
    status: string;
    visibility: string;
    updatedAt: string;
  }

  interface Props {
    rhymes: Rhyme[];
    initialSlug?: string;
    creatorWorkspace?: RhymesWorkspaceAccess;
    creatorPieces?: CreatorPieceSummary[];
    user?: { id: string } | null;
  }

  const { rhymes, initialSlug, creatorWorkspace, creatorPieces = [], user = null }: Props = $props();

  let editorOpen = $state(false);
</script>

<div class="flex flex-col h-screen overflow-hidden">
  <div class="flex items-start justify-between gap-4 px-4 py-4 md:px-6 md:py-5">
    <div>
      <a href="/" target="_self" class="block">
        <span class="font-medium text-2xl shrink-0 whitespace-nowrap md:text-4xl font-heading text-theme-peach-1"> rhymes </span>
      </a>
      <p class="mt-2 max-w-xl text-xs md:text-sm text-theme-peach-3">Browse, filter, and read without leaving the page.</p>
      {#if creatorWorkspace?.canAdmin}
        <a href="/admin/people" class="mt-2 inline-block text-xs text-theme-peach-2 underline">Manage rhymes people</a>
      {/if}
    </div>
    <div class="flex items-start justify-end gap-3 pt-1">
      {#if creatorWorkspace?.canCreate}
        <div class="border border-theme-peach-2/40 bg-theme-pink-3/80 px-3 py-2 text-right" aria-label="Creator workspace">
          <p class="text-[0.625rem] font-heading uppercase tracking-[0.18em] text-theme-peach-3">Creator workspace</p>
          <p class="mt-1 text-xs text-theme-peach-1">Signed in as {creatorWorkspace.role}</p>
        </div>
      {/if}
      <FilterSort {rhymes} />
    </div>
  </div>

  <div class="flex min-h-0 flex-1 flex-col">
    <div class="min-h-0 flex-1">
      <RhymeSelector {rhymes} useFiltered={true} {initialSlug} {user} />
    </div>
    <QuickComposer canCreate={creatorWorkspace?.canCreate ?? false} onOpenEditor={() => (editorOpen = true)} />
  </div>

  <ExpandedEditor
    open={editorOpen}
    canCreate={creatorWorkspace?.canCreate ?? false}
    {creatorPieces}
    onClose={() => (editorOpen = false)}
  />
</div>
