<script lang="ts">
  import { enhance } from "$app/forms";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
  import type { ActionData, PageData } from "./$types";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let name = $state("");
  let busy = $state(false);
  let deleteForm = $state<HTMLFormElement | null>(null);
  let confirmOpen = $state(false);
  let target = $state<PageData["tags"][number] | null>(null);

  function askDelete(tag: PageData["tags"][number]) {
    target = tag;
    confirmOpen = true;
  }

  const deleteBody = $derived(
    target
      ? target.songCount > 0
        ? `"${target.name}" is on ${target.songCount} song(s) for ${target.userCount} user(s). Removing it untags them everywhere. Songs and private custom tags are not deleted.`
        : `"${target.name}" isn't used yet. It disappears from every tag picker.`
      : ""
  );
</script>

<div class="space-y-6">
  {#if form?.error}
    <p class="auth-error">{form.error}</p>
  {:else if form && "ok" in form && form.ok}
    <p class="text-sm text-signal">{form.ok}</p>
  {/if}

  <form
    method="POST"
    action="?/create"
    class="space-y-3 rounded-lg border border-border/70 bg-card/50 p-4"
    use:enhance={() => {
      busy = true;
      return async ({ result, update }) => {
        await update({ reset: false });
        busy = false;
        if (result.type === "success") name = "";
      };
    }}
  >
    <div>
      <h2 class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Add system tag</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        System tags show in everyone’s tag picker. Custom tags stay private to the person who made them and aren’t managed here.
      </p>
    </div>
    <div class="flex flex-col gap-2 sm:flex-row">
      <input class="auth-field sm:max-w-xs" name="name" placeholder="e.g. chill" maxlength="64" autocomplete="off" bind:value={name} />
      <button type="submit" class="auth-btn w-fit" disabled={!name.trim() || busy}>Add tag</button>
    </div>
  </form>

  <div class="space-y-3">
    <h2 class="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">System tags ({data.tags.length})</h2>
    {#if data.tags.length === 0}
      <p class="rounded border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">No system tags.</p>
    {:else}
      <ul class="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/30">
        {#each data.tags as tag (tag.id)}
          <li class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div class="min-w-0">
              <p class="flex items-center gap-2">
                <span class="rounded-full border border-signal/40 bg-signal/10 px-2 py-0.5 font-mono text-[11px] text-signal">{tag.name}</span>
                <span class="font-mono text-[10px] text-muted-foreground">system</span>
              </p>
              <p class="mt-1 font-mono text-[11px] text-muted-foreground">
                {tag.songCount} song(s) · {tag.userCount} user(s)
                {#if tag.customTwins}· {tag.customTwins} private custom tag(s) share this name{/if}
              </p>
            </div>
            <button
              type="button"
              class="rounded border border-destructive/40 px-2 py-1 font-mono text-[11px] text-destructive hover:bg-destructive/10"
              disabled={busy}
              onclick={() => askDelete(tag)}>Remove</button
            >
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<form
  method="POST"
  action="?/delete"
  class="hidden"
  bind:this={deleteForm}
  use:enhance={() => {
    busy = true;
    return async ({ update }) => {
      await update();
      busy = false;
      confirmOpen = false;
    };
  }}
>
  <input type="hidden" name="tagId" value={target?.id ?? ""} />
</form>

<ConfirmDialog
  bind:open={confirmOpen}
  title={target ? `Remove "${target.name}"?` : "Remove tag?"}
  body={deleteBody}
  confirmLabel="Remove tag"
  danger
  {busy}
  onconfirm={() => deleteForm?.requestSubmit()}
/>
