<script lang="ts">
  import { goto } from "$app/navigation";
  import CreateFormSheet from "$lib/components/CreateFormSheet.svelte";
  import FormHero from "$lib/components/FormHero.svelte";
  import FormHistory from "$lib/components/FormHistory.svelte";
  import { authClient } from "$lib/auth-client";
  import { LogOut, Plus } from "@lucide/svelte";

  const { data } = $props();

  let signingOut = $state(false);
  let createOpen = $state(false);
  let launchedUrl = $state<string | null>(null);
  let sheetError = $state<string | null>(null);

  async function signOut() {
    signingOut = true;
    try {
      await authClient.signOut();
      await goto("/login");
    } finally {
      signingOut = false;
    }
  }
</script>

<svelte:head>
  <title>@{data.profileUser.username} · Me Via You</title>
</svelte:head>

<header class="flex items-center justify-between border-b border-border px-6 py-4">
  <div>
    <h1 class="text-lg font-bold tracking-wide">Me Via You</h1>
    <p class="text-sm text-accent">@{data.profileUser.username}</p>
  </div>

  {#if data.isOwner}
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
        onclick={() => {
          sheetError = null;
          createOpen = true;
        }}
      >
        <Plus size={14} aria-hidden="true" />
        New Form
      </button>

      <button
        type="button"
        class="inline-flex items-center gap-2 rounded border border-accent/40 px-3 py-1.5 text-sm text-accent hover:bg-accent/10 disabled:opacity-50"
        onclick={signOut}
        disabled={signingOut}
      >
        <LogOut size={14} aria-hidden="true" />
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  {/if}
</header>

<main class="mx-auto max-w-4xl space-y-12 px-6 py-10">
  <section class="space-y-4">
    <div>
      <p class="text-xs uppercase tracking-[0.2em] text-accent">
        {data.isOwner ? "Your feedback" : "Feedback"}
      </p>
      <h2 class="mt-2 text-2xl font-semibold text-foreground">
        {data.isOwner ? "What people see in you" : `What people see in @${data.profileUser.username}`}
      </h2>
    </div>
    <FormHero positives={data.hero.positives} negatives={data.hero.negatives} />
  </section>

  <FormHistory forms={data.forms} origin={data.origin} username={data.profileUser.username} isOwner={data.isOwner} showNotes={data.showNotes} />
</main>

{#if data.isOwner}
  <CreateFormSheet bind:open={createOpen} bind:launchedUrl bind:error={sheetError} />
{/if}
